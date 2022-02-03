// deno-lint-ignore-file no-explicit-any
import { Database, MongoClient, Collection, ConnectOptions, InsertDocument, FindOptions, CountOptions, Filter, UpdateFilter, Bson, InsertOptions } from '../dependencies/mongo.ts'
import { ObjectId, ProjectionType, SelectResult, PopulateOptions, PopulateSchema } from './types.ts'
import { wait } from './utulities.ts'

export class Model<Schema, populateSchema extends PopulateSchema = Record<never, never>> {
    public readonly client: MongoClient
    public readonly collectionName: string
    private PopulateOptions?: PopulateOptions
    #db?: Database
    #Model?: Collection<Schema>

    constructor(collectionName: string, conn: string, PopulateOptions?: PopulateOptions)
    constructor(collectionName: string, conn: MongoClient, PopulateOptions?: PopulateOptions)
    constructor(collectionName: string, conn: { client: MongoClient }, PopulateOptions?: PopulateOptions)
    constructor(collectionName: string, conn: { client: MongoClient, database: Database }, PopulateOptions?: PopulateOptions)
    constructor(collectionName: string, conn: { client: MongoClient, database: string }, PopulateOptions?: PopulateOptions)
    constructor(collectionName: string, conn: { ConnectionOptions: ConnectOptions }, PopulateOptions?: PopulateOptions)
    constructor(collectionName: string, conn: { ConnectionOptions: ConnectOptions, database: string }, PopulateOptions?: PopulateOptions)
    constructor(collectionName: string, conn: string | MongoClient | { client?: MongoClient, database?: Database | string, ConnectionOptions?: ConnectOptions }, PopulateOptions?: PopulateOptions) {
        this.PopulateOptions = PopulateOptions
        this.collectionName = collectionName
        if (typeof conn === 'string') {
            this.client = new MongoClient()
            this.connect({ connection: conn })
        } else if (conn instanceof MongoClient) {
            this.client = conn
            this.#db = this.client.database()
            this.#Model = this.#db.collection(this.collectionName)
        } else if ((<{ client: MongoClient }>conn).client) {
            if ((<{ database: Database | string }>conn).database) {
                if (typeof (<{ database: string }>conn).database === 'string') {
                    this.client = (<{ client: MongoClient }>conn).client
                    this.#db = this.client.database((<{ database: string }>conn).database)
                    this.#Model = this.#db.collection(this.collectionName)
                } else /* if ((<{ database: Database }>conn) instanceof Database ) */ {
                    this.client = (<{ client: MongoClient }>conn).client
                    this.#db = (<{ database: Database }>conn).database
                    this.#Model = this.#db.collection(this.collectionName)
                }
            } else {
                this.client = (<{ client: MongoClient }>conn).client
                this.#db = this.client.database()
                this.#Model = this.#db.collection(this.collectionName)
            }
        } else /* if ((<{ ConnectionOptions: ConnectOptions }>conn).ConnectionOptions) */ {
            this.client = new MongoClient()
            if ((<{ database: string }>conn).database) {
                this.connect({ connection: (<{ ConnectionOptions: ConnectOptions }>conn).ConnectionOptions, database: (<{ database: string }>conn).database })
            } else {
                this.connect({ connection: (<{ ConnectionOptions: ConnectOptions }>conn).ConnectionOptions })
            }
        }
    }

    public async getModel(): Promise<Collection<Schema>> {
        while (!this.#Model) { await wait(100) }
        return this.#Model
    }

    public async connect({ connection, database }: { connection: string | ConnectOptions, database?: string }): Promise<void> {
        await this.client.connect(connection)
        this.#db = this.client.database(database)
        this.#Model = this.#db.collection(this.collectionName)
    }

    public async insert(document: InsertDocument<Schema>, InsertOptions?: InsertOptions): Promise<ObjectId>
    public async insert(document: InsertDocument<Schema>[], InsertOptions?: InsertOptions): Promise<ObjectId[]>
    public async insert(document: InsertDocument<Schema>[] | InsertDocument<Schema>, InsertOptions?: InsertOptions): Promise<ObjectId | Required<InsertDocument<Schema>>["_id"] | (ObjectId | Required<InsertDocument<Schema>>["_id"])[]>  {
        const Model = await this.getModel()
        if (Array.isArray(document)) {
            return (await Model.insertMany(document, InsertOptions)).insertedIds
        } else {
            return await Model.insertOne(document)
        }
    }

    public async select<projection extends ProjectionType<Schema> | unknown, multiple extends boolean | unknown, populate extends true | string | string[] | unknown>
        (filter?: Filter<Schema>, options?: Omit<FindOptions, 'projection'> & { multiple?: multiple, populate?: populate, projection?: projection }):
        Promise<SelectResult<projection, Schema, populateSchema, populate, multiple>> {
        const Model = await this.getModel()
        const _options = Object.assign({}, options)
        const populate = ((populate: string[]) => { 
            return populate.map((key) => ({
                key, model: this.PopulateOptions && this.PopulateOptions[key]
            })).filter(a => a.model)
        })(
            _options.populate === true ?
                (this.PopulateOptions ? Object.keys(this.PopulateOptions) : []) :
            typeof _options.populate === 'string' ?
                [_options.populate] :
            Array.isArray(_options.populate) === true ?
                <string[]>_options.populate : []
        )
        delete _options.populate
        let document: Schema | Schema[] | undefined
        if (_options.multiple || _options.multiple === undefined) {
            delete _options.multiple
            document = await Model.find(filter, <any>_options).toArray()
        } else {
            delete _options.multiple
            document = await Model.findOne(filter, <any>_options)
        }
        const promises: Promise<void>[] = []
        if (document) {
            const documents = Array.isArray(document) ? document : [document]
            documents.forEach((document: any) => {
                populate.forEach(({key, model}) => {
                    if (Array.isArray(document[key])) {
                        model && promises.push(model.select({ $or: document[key].map((_id: any) => ({ _id })) }).then((result) => {
                            document[key] = result
                        }))
                    } else {
                        model && promises.push(model.select({ _id: document[key] }, { multiple: false }).then((result) => {
                            document[key] = result
                        }))
                    }
                })
            })
            // Object.keys(populate).forEach((collection) => {
            //     const documents = Array.isArray(document) ? document : [document]
            //     documents.forEach((doc) => {
            //         const paths: string[] = Array.isArray(populate[collection]) ? <string[]>populate[collection] : [<string>populate[collection]]
            //             paths.forEach((path: string) => {
            //             const [pointer, pointers] = ((a, b) => {
            //                 let planes: any[] = [ a ]
            //                 const vals = b.split('.')
            //                 const pointer = vals.pop()
            //                 while (vals.length > 0) {
            //                     if (Array.isArray(planes[0]) && isNaN(parseInt(vals[0]))) {
            //                         planes = planes.flat()
            //                     }
            //                     planes = planes.map((a) => a[vals[0]])
            //                     vals.shift()
            //                 }
            //                 if (Array.isArray(planes[0]) && isNaN(parseInt(pointer!))) {
            //                     planes = planes.flat()
            //                 }
            //                 return [pointer!, planes]
            //             })(doc, path)
            //             pointers.forEach((_p) => {
            //                 if (Array.isArray(_p[pointer])) {
            //                     const promise = Promise.all(_p[pointer].map((_id: ObjectId) => new Promise((res) => {
            //                         res(this.#db!.collection(collection).findOne({ _id }))
            //                     }))).then((data) => _p[pointer] = data)
            //                     promises.push(<any>promise)
            //                 } else {
            //                     promises.push(
            //                         new Promise((res) => {
            //                             res(this.#db!.collection(collection).findOne({ _id: _p[pointer] }))
            //                         }).then(() => {
            //                             _p[pointer] = _p
            //                         })
            //                     )
            //                 }
            //             })
            //         })
            //     })
            // })
        }
        await Promise.all(promises)
        return <any>document
    }

    public async update(filter: Filter<Schema>, document: Partial<Schema> & Bson.Document, options?: FindOptions & { multiple?: true }): Promise<ObjectId[]>
    public async update(filter: Filter<Schema>, document: Partial<Schema> & Bson.Document, options?: FindOptions & { multiple?: false }): Promise<ObjectId | unknown>
    public async update(filter: Filter<Schema>, document: Partial<Schema> & Bson.Document, options?: FindOptions & { multiple?: boolean }) {
        const Model = await this.getModel()
        const _options = Object.assign({}, options)
        if (_options.multiple || _options?.multiple === undefined) {
            delete _options?.multiple
            const updated = (await Model.find(filter, <any>_options).toArray()).map((a: any) => a._id)
            await Model.updateMany({ $or: updated.map((a => ({_id: a}))) }, <UpdateFilter<Schema>>{ $set: document })
            return updated
        } else {
            const updated = (await Model.findOne(filter, <any>_options))
            delete _options?.multiple
            updated && await Model.updateOne({ _id: updated }, <UpdateFilter<Schema>>{ $set: document })
            return updated
        }
    }

    public async delete(filter?: Filter<Schema>, options?: FindOptions & { multiple?: true }): Promise<ObjectId[]>
    public async delete(filter?: Filter<Schema>, options?: FindOptions & { multiple?: false }): Promise<ObjectId | unknown>
    public async delete(filter?: Filter<Schema>, options?: FindOptions & { multiple?: boolean }): Promise<ObjectId | unknown | ObjectId[]> {
        const Model = await this.getModel()
        const _options = Object.assign({}, options)
        if (_options.multiple || _options?.multiple === undefined) {
            const deleted = (await Model.find(filter, <any>_options).toArray()).map((a: any) => a._id)
            await Model.deleteMany({ $or: deleted.map((a => ({_id: a}))) }, options)
            return deleted
        } else {
            const deleted = (await Model.findOne(filter, <any>_options))
            await Model.deleteOne({ _id: deleted }, options)
            return deleted
        }
    }
    public async count(filter: Filter<Schema>, options?: CountOptions) {
        const Model = await this.getModel()
        return await Model.countDocuments(filter, options)
    }
}