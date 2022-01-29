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

const result1 = await model.insert([{ name: 'iyy', number: 31 },{ name: 'iyy', number: 31 },{ name: 'iyy', number: 31 },{ name: 'iyy', number: 31 },{ name: 'iyy', number: 31 }])
console.log(5, result1)

const result2 = await model.update({ name: 'iyy' }, { name: 'aww' })
console.log(6, result2)

const result3 = await model.select({ name: 'aww' })
console.log(7, result3)

const result4 = await model.count({ name: 'aww' })
console.log(8, result4)

const result5 = await model.delete({ name: 'aww' })
console.log(9, result5)

const result6 = await model.count({ name: 'aww' })
console.log(10, result6)