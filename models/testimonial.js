const mongoose = require('mongoose')
const schema = mongoose.Schema
const testimonialSchema = new schema(
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

const Testimonial = mongoose.model('Testimonial', testimonialSchema)
module.exports = Testimonial