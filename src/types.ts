import { Model } from './main.ts'
import { Bson, FindOptions } from '../dependencies/mongo.ts'

export type InsertId<Type> = Omit<Type, '_id'> & { _id: ObjectId }
export type filterKeys<A,B> = Extract<keyof A, keyof B>

export type removeKeysByNotValue<Object, Value> = { [Key in keyof Object as Object[Key] extends Value ? Key : never]: Object[Key] }
export type removeKeysByValue<Object, Value> = { [Key in keyof Object as Object[Key] extends Value ? never : Key ]: Object[Key] }


export type PropertyExists<Type> = keyof Type extends never ? false : true
export type RemoveNotTrue<Type> = Omit<Type, Extract<keyof removeKeysByNotValue<Type, false>, keyof Type>>
export type ProjectionRemoveNotTrue<projection, Schema> = Pick<Schema, Extract<keyof removeKeysByNotValue<projection, true>, keyof Schema>>
export type ProjectionRemoveFalse<projection, Schema> = Omit<Schema, Extract<keyof removeKeysByValue<projection, true>, keyof Schema>>


export type ConfigurePopulateSchema<Schema, PopulateSchema> = {
    [P in keyof PopulateSchema]:
        Schema[Extract<P, keyof Schema>] extends ObjectId[] ?
            InsertId<PopulateSchema[P]>[] :
        InsertId<PopulateSchema[P]>
}

export type InsertPopulate<Schema, PopulateSchema, populate> =
    populate extends readonly string[] ?
        Omit<Schema, Extract<keyof PopulateSchema, populate[number]>> & Pick<ConfigurePopulateSchema<Schema, PopulateSchema>, Extract<keyof ConfigurePopulateSchema<Schema, PopulateSchema>, populate[number]>> :
    populate extends keyof PopulateSchema ?
        Omit<Schema, keyof Pick<PopulateSchema, populate>> & Pick<ConfigurePopulateSchema<Schema, PopulateSchema>, populate> :
    populate extends true ?
        Omit<Schema, keyof PopulateSchema> & ConfigurePopulateSchema<Schema, PopulateSchema> :
    Schema

export type ConvertToBoolean<T> = {
    [P in keyof T]: boolean
}

export type ObjectId = Bson.ObjectId


export type ProjectionType<Schema> = Partial<ConvertToBoolean<InsertId<Schema>>>
export type PopulateOptions = Record<string, Model<any>>
export type PopulateSchema = Record<string, any>

export type extractElse<Object, pick extends keyof Object> = { [Key in keyof Object as Key extends pick ? Key : never]: Object[Key] }
export type extractedKeys<Type, Key extends keyof Type> = keyof extractElse<Type, Key>
export type returnKeyIfSet<Type, Key extends string> = extractedKeys<Type, Extract<keyof Type, Key>>
export type IsIdSetFalse<projection> = keyof { [P in keyof projection as P extends '_id' ? (projection[P] extends false ? P : never) : never]: projection[P] } extends never ? true : false

export type Project<projection, Schema> =
    PropertyExists<RemoveNotTrue<projection>> extends true ?
        (IsIdSetFalse<projection> extends true ?
            InsertId<ProjectionRemoveNotTrue<projection, InsertId<Schema>>> :
            ProjectionRemoveNotTrue<projection, InsertId<Schema>>) :
        (ProjectionRemoveFalse<projection, InsertId<Schema>>)

export type SelectResultDefault<projection, Schema, PopulateSchema, populate> =
    InsertPopulate<Project<projection, Schema>, PopulateSchema, populate>
export type SelectResult<projection, Schema, PopulateSchema, populate, multiple> =
    multiple extends false ?
    SelectResultDefault<projection, Schema, PopulateSchema, populate> :
    SelectResultDefault<projection, Schema, PopulateSchema, populate>[]
