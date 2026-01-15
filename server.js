const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const multer = require('multer');
const nodemailer = require('nodemailer');
const smtpTransport = require("nodemailer-smtp-transport")
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024}
});
const cookieParser = require('cookie-parser');
const path = require('path')
const Parcel = require('./models/goods.js');

const database = process.env.MONGO_URI

let isConnected = false;

async function connectDB() {
    if (isConnected) return;

    try {
        await mongoose.connect(database);
        isConnected = true;
        console.log("Database server is connected");
    } catch (err) {
        console.error("MongoDB connection error", err);
    }
}

connectDB();

const app = express()
const port = process.env.PORT || 8080;

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({extended:true}))
app.use(methodOverride('_method'))
app.use(cookieParser())
app.use(express.json())

app.get('/', (req, res)=>{
    res.render('index', {title: 'HOME', q:""})
})

app.get('/abtus', (req, res)=>{
    res.render('aboutus', {title: 'ABOUT US', q:""})
})

app.get('/track', (req, res)=>{
    res.render('track', {title: 'TRACK PARCEL', q:""})
})

app.get("/dashboard", (req, res)=>{
    res.render('dashboard', {title: 'DASHBOARD', q:""})
})

app.get('/services', async (req, res)=>{
    const parcels = (await Parcel.find()).reverse()
    const statusColor = {
        PENDING: "red",
        TRANSIT: "orange",
        ARRIVED: "yellowgreen",
        DELIVERED: "green"
    };

    res.render('logistic', {title: 'LOGISTICS', parcels, statusColor, q:""})
})

app.get('/form', (req, res)=>{
    res.render('form', {title: 'FORM', q:""})
})

app.post("/logistics", upload.single('image'), async (req, res)=>{
    try {
        const {sender, senderEmail, recipientEmail, receiver, description, statusLevel, from , to} = req.body;
        
        const photoBuffer = req.file.buffer;
        const contentType = req.file.mimetype;

        console.log(req.file)
        const parcel = new Parcel({
            sender:sender,
            senderEmail:senderEmail,
            recipientEmail:recipientEmail,
            receiver:receiver,
            from:from,
            to:to,
            description:description,
            statusLevel,
            image:{
                data:photoBuffer,
                contentType:contentType
            }
        });

        parcel.trackingNumber= parcel._id.toString().slice(0, 6);

    console.log(parcel)

    await parcel.save().then(()=>{
        const transporter = nodemailer.createTransport(
            smtpTransport({
                service:'gmail',
                host:'smtp.gmail.com',
                port: 465,
                secure: true,
                auth: {
                    user: process.env.USER_EMAIL,
                    pass: process.env.USER_PASS
                }
            })
        )

        const mailOptions = {
            from: 'ABC Logistics Company',
            to: [senderEmail, recipientEmail],
            bcc: 'francisozurumba96@gmail.com',
            subject: 'Parcel Successfully Sent',
            html: `
                <p>This is to inform you that parcel sent by <strong> ${sender} </strong> to <strong> ${receiver} </strong> has been successfully processed and is currently in progress.</p>
                <p>You will be notified of any further updates regarding its status.</p>
                <h3> Tracking Number: ${parcel.trackingNumber} </h3>
                <h4> Status Level: ${statusLevel} </h4>
                <p><strong>Thank you for your cooperation.</strong></p>.`
        }

        transporter.sendMail(mailOptions, (error, info)=>{
            if (error) {
                console.log(error)
            }
        })
        res.redirect('/services')
    })

    } catch (error) {
        console.log(error)
        res.redirect('/')
    }
})

app.get("/single/:postid", async (req, res)=>{
    const postID = req.params.postid;
    const parcel = await Parcel.findById(postID);
    res.render("details", {title: 'SINGLE', parcel, q:""})
})

app.get("/search", async (req, res)=>{
    try {
        const { q } = req.query;
        const statusColor = {
        PENDING: "red",
        TRANSIT: "orange",
        ARRIVED: "yellowgreen",
        DELIVERED: "green"
    };
        
        let parcels;

        if (q) {
            parcels = await Parcel.find(
                { trackingNumber: {$regex: q, $options: "i"}},
                {image: 0}
            ).sort({_id: -1})
        } else {
            parcels = await Parcel.find({}, {image: 0}).sort({_id: -1})
        }
        res.render('logistic', {title: 'LOGISTICS', parcels, statusColor, q});
    } catch (err) {
        console.log(err);
        res.redirect('/')
    }
})

app.get('/parcel/:id/image', async (req, res) => {
    const parcel = await Parcel.findById(req.params.id);
    if (!parcel || !parcel.image || !parcel.image.data) {
        res.redirect("/")
    }
    res.contentType(parcel.image.contentType);
    res.send(parcel.image.data)
})

app.get("/parcel/edit/:postid", async (req, res)=>{
    const postID = req.params.postid;
    const parcel = await Parcel.findById(postID);
    // console.log(parcel)
    res.render("edit", {title: 'EDIT', parcel, q:""})
})

app.put("/update/:postid", async (req, res)=>{
    try {
        const postID = req.params.postid;
        const oldParcel = await Parcel.findById(postID);

        const status = req.body;
        console.log(status);
        const updateParcel = await Parcel.findByIdAndUpdate(postID, status, {new: true, runValidators: true});
        
        if (oldParcel.statusLevel !== updateParcel.statusLevel) {
            const transporter = nodemailer.createTransport(
                smtpTransport({
                    service:'gmail',
                    host:'smtp.gmail.com',
                    port: 465,
                    secure: true,
                    auth: {
                        user: process.env.USER_EMAIL,
                        pass: process.env.USER_PASS
                    }
                })
            )

            const mailOptions = {
                from: 'ABC Logistics Company',
                to: [oldParcel.senderEmail, oldParcel.recipientEmail],
                bcc: 'francisozurumba96@gmail.com',
                subject: 'Parcel Status Update',
                html: `
                    <p>This is to inform you that parcel sent by <strong> ${oldParcel.sender} </strong> to <strong> ${oldParcel.receiver} </strong> has a new status update.</p>
                    <h3> Tracking Number: ${oldParcel.trackingNumber} </h3>
                    <h3> Status Level: ${updateParcel.statusLevel} </h4>
                    <p><strong>Thank you for your cooperation.</strong></p>.`
            }

            transporter.sendMail(mailOptions, (error, info)=>{
                if (error) {
                    console.log(error)
                }
            })
        }
        
        res.redirect("/services")
    } catch (err) {
        console.log(err)
    }
})

app.delete('/parcel/:postid', async (req, res)=>{
    try {
        const postID = req.params.postid;
        const deleteParcel = await Parcel.findByIdAndDelete(postID);
        res.redirect('/services')
    } catch (err) {
        console.log(err)
    }
})    

app.use((req, res)=>{
    res.render("404", {title: 'ERROR', q:""})
})

module.exports = app;
