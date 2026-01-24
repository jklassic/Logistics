const mongoose = require('mongoose')
const schema = mongoose.Schema
const workerSchema = new schema(
    {
        workerID:{
            type:String
        },

        firstName:{
            type:String,
            required:true
        },

        secondName:{
            type:String,
            required:true
        },
        
        email:{
            type:String,
            required:true
        },

        phoneNo:{
            type:String,
            required:true
        },

        branch:{
            type:String,
            required:true
        },

        password:{
            type:String,
            required:true
        },

        role:{
            type:String,
            required:true
        },

        image:{
            data:Buffer,
            contentType:String
        },

        approved:{
            type:Boolean,
            default:false
        }
    },
    {timestamps: true}
);

const Worker = mongoose.model('Worker', workerSchema)
module.exports = Worker