import { MONGO } from "./depts.ts"
const { MongoClient } = MONGO
function wait(time: number) { return new Promise((res) => setTimeout(res, time)) }

export type ObjectId = MONGO.Bson.ObjectId
export type InsertId<Type> = Type & { _id: ObjectId }

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

    public async insert(document: MONGO.InsertDocument<T>, InsertOptions?: MONGO.InsertOptions): Promise<ObjectId>
    public async insert(document: MONGO.InsertDocument<T>[], InsertOptions?: MONGO.InsertOptions): Promise<ObjectId[]>
    public async insert(document: MONGO.InsertDocument<T>[] | MONGO.InsertDocument<T>, InsertOptions?: MONGO.InsertOptions): Promise<ObjectId | Required<MONGO.InsertDocument<T>>["_id"] | (ObjectId | Required<MONGO.InsertDocument<T>>["_id"])[]>  {
        const Model = await this.getModel()
        if (Array.isArray(document)) {
            return (await Model.insertMany(document, InsertOptions)).insertedIds
        } else {
            return await Model.insertOne(document)
        }
    }

    public async select<Populate>(filter?: MONGO.Filter<T>, options?: MONGO.FindOptions & { multiple?: true, populate?: { [collection: string]: string | string[] } }): Promise<(T & { _id: ObjectId } & (Populate & { _id: ObjectId }))[]>
    public async select<Populate>(filter?: MONGO.Filter<T>, options?: MONGO.FindOptions & { multiple?: false, populate?: { [collection: string]: string | string[] } }): Promise<T & { _id: ObjectId } & (Populate & { _id: ObjectId }) | undefined>
    public async select<Populate>(filter?: MONGO.Filter<T>, options?: MONGO.FindOptions & { multiple?: boolean, populate?: { [collection: string]: string | string[] } }): Promise<T & (Populate  & { _id: ObjectId }) | undefined | (T & (Populate & { _id: ObjectId }))[]> {
        const Model = await this.getModel()
        const _options = Object.assign({}, options)
        const populate = _options.populate
        if (populate) {
            delete _options.populate
        }
        let document: T | T[] | undefined
        if (_options.multiple || _options?.multiple === undefined) {
            delete _options.multiple
            document = await Model.find(filter, _options).toArray()
        } else {
            delete _options.multiple
            document = await Model.findOne(filter, _options)
        }
        const promises: Promise<void>[] = []
        if (document && populate) {
            Object.keys(populate).forEach((collection) => {
                const documents = Array.isArray(document) ? document : [document]
                documents.forEach((doc) => {
                    const paths = Array.isArray(populate[collection]) ? populate[collection] : [populate[collection]]
                        ;(<any>paths).forEach((path: string) => {
                        const [pointer, pointers] = ((a,b) => {
                            let planes: any = [ a ]
                            const vals = b.split('.')
                            const pointer: any = vals.pop()
                            while (vals.length > 0) {
                                if (Array.isArray(planes[0]) && isNaN(parseInt(vals[0]))) {
                                    planes = planes.flat()
                                }
                                planes = planes.map((a: any) => a[vals[0]])
                                vals.shift()
                            }
                            if (Array.isArray(planes[0]) && isNaN(parseInt(pointer))) {
                                planes = planes.flat()
                            }
                            return [pointer, planes]
                        })(doc, path)
                        pointers.forEach((_p: any) => {
                            if (Array.isArray(_p[pointer])) {
                                const promise = Promise.all(_p[pointer].map((_id: ObjectId) => new Promise((res) => {
                                    res(this.db!.collection(collection).findOne({ _id }))
                                }))).then((data) => _p[pointer] = data)
                                promises.push(<any>promise)
                            } else {
                                promises.push(
                                    new Promise((res) => {
                                        res(this.db!.collection(collection).findOne({ _id: _p[pointer] }))
                                    }).then(() => {
                                        _p[pointer] = _p
                                    })
                                )
                            }
                        })
                    })
                })
            })
        }
        await Promise.all(promises)
        return <T & (Populate  & { _id: ObjectId }) | undefined | (T & (Populate & { _id: ObjectId }))[]>document
    }

    public async update(filter: MONGO.Filter<T>, document: Partial<T> & MONGO.Bson.Document, options?: MONGO.FindOptions & { multiple?: true }): Promise<ObjectId[]>
    public async update(filter: MONGO.Filter<T>, document: Partial<T> & MONGO.Bson.Document, options?: MONGO.FindOptions & { multiple?: false }): Promise<ObjectId | unknown>
    public async update(filter: MONGO.Filter<T>, document: Partial<T> & MONGO.Bson.Document, options?: MONGO.FindOptions & { multiple?: boolean }) {
        const Model = await this.getModel()
        const _options = Object.assign({}, options)
        if (_options.multiple || _options?.multiple === undefined) {
            const updated = (await this.select(filter, { multiple: true, projection: { _id: true } })).map(({ _id }) => _id)
            delete _options?.multiple
            await Model.updateMany({ $or: updated.map((a => ({_id: a}))) }, <MONGO.UpdateFilter<T>>{ $set: document })
            return updated
        } else {
            const updated = (await this.select(filter, { multiple: false, projection: { _id: true } }))?._id
            delete _options?.multiple
            updated && await Model.updateOne({ _id: updated }, <MONGO.UpdateFilter<T>>{ $set: document })
            return updated
        }
    }

    public async delete(filter?: MONGO.Filter<T>, options?: MONGO.FindOptions & { multiple?: true }): Promise<ObjectId[]>
    public async delete(filter?: MONGO.Filter<T>, options?: MONGO.FindOptions & { multiple?: false }): Promise<ObjectId | unknown>
    public async delete(filter?: MONGO.Filter<T>, options?: MONGO.FindOptions & { multiple?: boolean }): Promise<ObjectId | unknown | ObjectId[]> {
        const Model = await this.getModel()
        const _options = Object.assign({}, options)
        if (_options.multiple || _options?.multiple === undefined) {
            const deleted = (await this.select(filter, { multiple: true, projection: { _id: true } })).map(({ _id }) => _id)
            await Model.deleteMany({ $or: deleted.map((a => ({_id: a}))) }, options)
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