const mongoose = require('mongoose')
const schema = mongoose.Schema
const reviewSchema = new schema(
    {
        message:{
            type:String,
            required:true
        },

        name:{
            type:String,
            required:true
        },

        occupation:{
            type:String,
            required:true
        }
    },
    { timestamps: true}
);

const Review = mongoose.model('Review', reviewSchema)
module.exports = Review