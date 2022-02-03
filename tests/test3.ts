import 'https://deno.land/x/dotenv@v3.1.0/load.ts'
import DBModel from '../mod.ts'
import { ObjectId } from '../mod.ts'
import { MongoClient } from 'https://deno.land/x/mongo@v0.29.1/mod.ts'
const mongo = new MongoClient()
await mongo.connect(<string>Deno.env.get('DataBaseURL'))


export type Auth = {
    Email: string
    Passowrd: string
}
export type Profile = {
    Name: string
    Surname: string
}

export type User = {
    Auth: ObjectId,
    Profile: ObjectId[]
    Gaga: string
}



export const Profile = new DBModel<Profile>("ProfileCollection", mongo)
export const Auth = new DBModel<Auth>("AuthCollection", mongo)
export const User = new DBModel<User, { Profile: Profile, Auth: Auth }>("UserCollection", mongo, { Profile: Profile, Auth: Auth })

// await User.insert({
//     Profile: await Profile.insert([{ Name: 'uwu', Surname: 'gg' }, { Name: 'uwu', Surname: 'gg' }, { Name: 'uwu', Surname: 'gg' }]),
//     Auth: await Auth.insert({ Email: 'ww', Passowrd: 'yy' }),
//     Gaga: 'www'
// })

const r1 = await User.select({}, { })
const r2 = await User.select({}, { multiple: false, populate: false } as const)
const r3 = await User.select({}, { multiple: false, populate: true } as const)
const r4 = await User.select({}, { multiple: false, populate: 'Auth' } as const)
const r5 = await User.select({}, { multiple: false, populate: ['Profile']} as const)


console.log(r1,r2,r3,r4,r5)