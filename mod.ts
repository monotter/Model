import { MONGO } from "./depts.ts"
const { MongoClient } = MONGO
function wait(time: number) { return new Promise((res) => setTimeout(res, time)) }

export type ObjectId = MONGO.Bson.ObjectId
export default class Model <T> {
    public client: MONGO.MongoClient
    public db?: MONGO.Database
    public collectionName: string
    private Model?: MONGO.Collection<T>
    constructor(collectionName: string, conn: string)
    constructor(collectionName: string, conn: MONGO.MongoClient)
    constructor(collectionName: string, conn: { client: MONGO.MongoClient })
    constructor(collectionName: string, conn: { client: MONGO.MongoClient, database: MONGO.Database })
    constructor(collectionName: string, conn: { client: MONGO.MongoClient, database: string })
    constructor(collectionName: string, conn: { ConnectionOptions: MONGO.ConnectOptions })
    constructor(collectionName: string, conn: { ConnectionOptions: MONGO.ConnectOptions, database: string })
    constructor(collectionName: string, conn?: string | MONGO.MongoClient | { client?: MONGO.MongoClient, database?: MONGO.Database | string, ConnectionOptions?: MONGO.ConnectOptions }) {
        this.collectionName = collectionName
        if (typeof conn === 'string') {
            this.client = new MongoClient()
            this.connect({ connection: conn })
        } else if (conn instanceof MongoClient) {
            this.client = conn
            this.db = this.client.database()
            this.Model = this.db.collection(this.collectionName)
        } else if ((<{ client: MONGO.MongoClient }>conn).client) {
            if ((<{ database: MONGO.Database | string }>conn).database) {
                if (typeof (<{ database: string }>conn).database === 'string') {
                    this.client = (<{ client: MONGO.MongoClient }>conn).client
                    this.db = this.client.database((<{ database: string }>conn).database)
                    this.Model = this.db.collection(this.collectionName)
                } else /* if ((<{ database: MONGO.Database }>conn) instanceof Database ) */ {
                    this.client = (<{ client: MONGO.MongoClient }>conn).client
                    this.db = (<{ database: MONGO.Database }>conn).database
                    this.Model = this.db.collection(this.collectionName)
                }
            } else {
                this.client = (<{ client: MONGO.MongoClient }>conn).client
                this.db = this.client.database()
                this.Model = this.db.collection(this.collectionName)
            }
        } else /* if ((<{ ConnectionOptions: MONGO.ConnectOptions }>conn).ConnectionOptions) */ {
            this.client = new MongoClient()
            if ((<{ database: string }>conn).database) {
                this.connect({ connection: (<{ ConnectionOptions: MONGO.ConnectOptions }>conn).ConnectionOptions, database: (<{ database: string }>conn).database })
            } else {
                this.connect({ connection: (<{ ConnectionOptions: MONGO.ConnectOptions }>conn).ConnectionOptions })
            }
        }
    }

    public async getModel(): Promise<MONGO.Collection<T>> {
        while (!this.Model) { await wait(100) }
        return this.Model
    }

    public async connect({ connection, database }: { connection: string | MONGO.ConnectOptions, database?: string }): Promise<void> {
        await this.client.connect(connection)
        this.db = this.client.database(database)
        this.Model = this.db.collection(this.collectionName)
    }

    public async insert(document: MONGO.InsertDocument<T>, InsertOptions?: MONGO.InsertOptions): Promise<MONGO.Bson.ObjectId>
    public async insert(document: MONGO.InsertDocument<T>[], InsertOptions?: MONGO.InsertOptions): Promise<MONGO.Bson.ObjectId[]>
    public async insert(document: MONGO.InsertDocument<T>[] | MONGO.InsertDocument<T>, InsertOptions?: MONGO.InsertOptions): Promise<MONGO.Bson.ObjectId | Required<MONGO.InsertDocument<T>>["_id"] | (MONGO.Bson.ObjectId | Required<MONGO.InsertDocument<T>>["_id"])[]>  {
        const Model = await this.getModel()
        if (Array.isArray(document)) {
            return (await Model.insertMany(document, InsertOptions)).insertedIds
        } else {
            return await Model.insertOne(document)
        }
    }

    public async select(filter: MONGO.Filter<T>, options?: MONGO.FindOptions & { multiple?: true }): Promise<(T & { _id: MONGO.Bson.ObjectId })[]>
    public async select(filter: MONGO.Filter<T>, options?: MONGO.FindOptions & { multiple?: false }): Promise<T & { _id: MONGO.Bson.ObjectId } | undefined>
    public async select(filter: MONGO.Filter<T>, options?: MONGO.FindOptions & { multiple?: boolean }): Promise<T | undefined | T[]> {
        const Model = await this.getModel()
        const _options = Object.assign({}, options)
        if (_options.multiple || _options?.multiple === undefined) {
            delete _options?.multiple
            return await Model.find(filter, _options).toArray()
        } else {
            delete _options?.multiple
            return await Model.findOne(filter, _options)
        }
    }

    public async update(filter: MONGO.Filter<T>, document: MONGO.UpdateFilter<T>, options?: MONGO.FindOptions & { multiple?: true }): Promise<MONGO.Bson.ObjectId[]>
    public async update(filter: MONGO.Filter<T>, document: MONGO.UpdateFilter<T>, options?: MONGO.FindOptions & { multiple?: false }): Promise<MONGO.Bson.ObjectId | unknown>
    public async update(filter: MONGO.Filter<T>, document: MONGO.UpdateFilter<T>, options?: MONGO.FindOptions & { multiple?: boolean }) {
        const Model = await this.getModel()
        const _options = Object.assign({}, options)
        if (_options.multiple || _options?.multiple === undefined) {
            const updated = (await this.select(filter, { multiple: true, projection: { _id: true } })).map(({ _id }) => _id)
            delete _options?.multiple
            await Model.updateMany({ _id: updated }, document)
            return updated
        } else {
            const updated = (await this.select(filter, { multiple: false, projection: { _id: true } }))?._id
            delete _options?.multiple
            updated && await Model.updateOne({ _id: updated }, document)
            return updated
        }
    }

    public async delete(filter: MONGO.Filter<T>, options?: MONGO.FindOptions & { multiple?: true }): Promise<MONGO.Bson.ObjectId[]>
    public async delete(filter: MONGO.Filter<T>, options?: MONGO.FindOptions & { multiple?: false }): Promise<MONGO.Bson.ObjectId | unknown>
    public async delete(filter: MONGO.Filter<T>, options?: MONGO.FindOptions & { multiple?: boolean }): Promise<MONGO.Bson.ObjectId | unknown | MONGO.Bson.ObjectId[]> {
        const Model = await this.getModel()
        const _options = Object.assign({}, options)
        if (_options.multiple || _options?.multiple === undefined) {
            const deleted = (await this.select(filter, { multiple: true, projection: { _id: true } })).map(({ _id }) => _id)
            await Model.deleteMany({ _id: deleted }, options)
            return deleted
        } else {
            const deleted = (await this.select(filter, { multiple: false, projection: { _id: true } }))?._id
            await Model.deleteOne({ _id: deleted }, options)
            return deleted
        }
    }
    public async count(filter: MONGO.Filter<T>, options?: MONGO.CountOptions) {
        const Model = await this.getModel()
        return await Model.countDocuments(filter, options)
    }
}