const mongoose = require('mongoose')
const schema = mongoose.Schema
const mgmtSchema = new schema(
    {
        adminID:{
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
            default:true
        }
    },
    { timestamps: true}
);

const Mgmt = mongoose.model('Mgmt', mgmtSchema);
module.exports = Mgmt;