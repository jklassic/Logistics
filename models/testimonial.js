const mongoose = require('mongoose')
const schema = mongoose.Schema
const testimonialSchema = new schema(
    {
        name:{
            type:String,
            required:true
        },

        occupation:{
            type:String,
            enum: ['Student', 'Unemployed', 'Self-Employed', 'Employed'],
            required:true
        },

        rating:{
            type:Number,
            required:true
        },

        comment:{
            type:String,
            required:true
        },
    },
    { timestamps: true}
);

const Testimonial = mongoose.model('Testimonial', testimonialSchema)
module.exports = Testimonial