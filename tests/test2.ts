import 'https://deno.land/x/dotenv@v3.1.0/load.ts'
import { MongoClient } from 'https://deno.land/x/mongo@v0.29.1/mod.ts'
import DBModel from '../mod.ts'
console.log(1)
const DataBaseURL = <string>Deno.env.get('DataBaseURL')
console.log(2, DataBaseURL)
export const mongo = new MongoClient()
console.log(3)
await mongo.connect(DataBaseURL)
console.log(4)



const model = new DBModel<{
    number: number,
    name: string
}>('abc', mongo)

const result1 = await model.insert([{ name: 'iyy', number: 33 },{ name: 'iyy', number: 11 },{ name: 'iyy', number: 2 },{ name: 'iyy', number: 7 },{ name: 'iyy', number: 1 }])
console.log(5, result1)

const result2 = await model.update({ number: { $gte: 31 } }, { $set: { name: 'aww' } })
console.log(6, result2)