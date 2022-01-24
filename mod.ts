import { MongoClient, ConnectOptions, Database, Collection, InsertDocument, Filter, InsertOptions, FindOptions, UpdateFilter, UpdateOptions, DeleteOptions, CountOptions } from "./depts.ts"
function wait(time: number) { return new Promise((res) => setTimeout(res, time)) }


export default class Model <T> {
    public client: MongoClient
    public Schema: T
    public db?: Database
    public collectionName: string
    private Model?: Collection<T>
    constructor(collectionName: string, Schema: T, { connection, database }: { connection: string | ConnectOptions | MongoClient, database?: string }) {
        this.Schema = Schema
        this.collectionName = collectionName
        if (connection instanceof MongoClient) {
            this.client = connection
        } else {
            this.client = new MongoClient()
            this.connect({ connection, database })
        }
    }

    public async getModel(): Promise<Collection<T>> {
        while (!this.Model) { await wait(100) }
        return this.Model
    }

    public async connect({ connection, database }: { connection: string | ConnectOptions, database?: string }): Promise<void> {
        await this.client.connect(connection)
        this.db = this.client.database(database)
        this.Model = this.db.collection(this.collectionName)
    }


    public async insert(document: InsertDocument<T> | InsertDocument<T>[], InsertOptions: InsertOptions) {
        const Model = await this.getModel()
        if (Array.isArray(document)) {
            return await Model.insertMany(document, InsertOptions)
        } else {
            return await Model.insertOne(document)
        }
    }
    public async select(filter: Filter<T>, options: FindOptions & { multiple?: boolean } = { multiple: true }) {
        const Model = await this.getModel()
        if (options.multiple) {
            delete options.multiple
            return await Model.findOne(filter, options)
        } else {
            delete options.multiple
            return await Model.find(filter, options)
        }
    }
    public async update(filter: Filter<T>, document: UpdateFilter<T>, options: UpdateOptions & { multiple?: boolean } = { multiple: true }) {
        const Model = await this.getModel()
        if (options.multiple) {
            delete options.multiple
            return await Model.updateMany(filter, document, options)
        } else {
            delete options.multiple
            return await Model.updateOne(filter, document, options)
        }
    }
    public async delete(filter: Filter<T>, options: DeleteOptions & { multiple?: boolean } = { multiple: true }) {
        const Model = await this.getModel()
        if (options.multiple) {
            return await Model.deleteMany(filter, options)
        } else {
            return await Model.deleteOne(filter, options)
        }
    }
    public async count(filter: Filter<T>, options: CountOptions) {
        const Model = await this.getModel()
        return await Model.countDocuments(filter, options)
    }
}