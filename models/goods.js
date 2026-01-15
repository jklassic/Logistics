const mongoose = require('mongoose')
const schema = mongoose.Schema
const parcelSchema = new schema(
    {
        trackingNumber:{
            type:String
        },

        sender:{
            type:String,
            required:true
        },

        senderEmail:{
            type:String,
            required:true
        },
        
        recipientEmail:{
            type:String,
            required:true
        },

        receiver:{
            type:String,
            required:true
        },

        from:{
            type:String,
            required:true
        },

        to:{
            type:String,
            required:true
        },

        description:{
            type:String,
            required:true
        },

        statusLevel:{
            type:String,
            enum: ['PENDING', 'TRANSIT', 'ARRIVED', 'DELIVERED'],
            required:true
        },

        image:{
            data:Buffer,
            contentType:String
        }
    },
    { timestamps: true}
);

const Parcel = mongoose.model('Parcel', parcelSchema)
module.exports = Parcel