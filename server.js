const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const multer = require('multer');
const flash = require('connect-flash');
const MongoStore = require('connect-mongo').default;
const session = require('express-session');
const nodemailer = require('nodemailer');
const smtpTransport = require("nodemailer-smtp-transport");
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024}
});
const cookieParser = require('cookie-parser');
const path = require('path');
const Mgmt = require('./models/mgmt.js')
const Worker = require('./models/workers.js')
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

app.set('trust proxy', 1);

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'));

app.use(flash())
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({extended:true}))
app.use(methodOverride('_method'))
app.use(cookieParser())
app.use(express.json())

app.use(session({
    name: 'logistics_sessions',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'sessions'
    }),
    cookie: {
        httpOnly: true,
        secure: false, 
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

app.use((req, res, next) => {
    res.locals.currentUser = req.session.user;
    next();
});

function isAuthenticated (req, res, next) { // this is for worker
    if (req.session.user) return next()
    res.redirect('/signin')
}

function isAdmin (req, res, next) { // this is for the admin
    if (req.session.user && req.session.user.role === 'admin') return next();
    res.redirect('/signin');
}


app.get('/', (req, res)=>{
    res.render('index', {title: 'HOME', q:"", messages: req.flash('info')})
})

app.get('/abtus', (req, res)=>{
    res.render('aboutus', {title: 'ABOUT US', q:""})
})

app.get('/track', (req, res)=>{
    res.render('track', {title: 'TRACK PARCEL', q:""})
})

app.get('/clerks', isAuthenticated, isAdmin, async (req, res)=>{
    const mgmts = (await Mgmt.find()).reverse()
    const workers = (await Worker.find()).reverse()
    res.render('clerks', {title: 'CLERKS', workers, mgmts, q:""})
})

app.get("/dashboard", isAuthenticated, isAdmin, async (req, res)=>{
    const parcels = (await Parcel.find()).reverse()
    const statusColor = {
        PENDING: "red",
        TRANSIT: "orange",
        ARRIVED: "yellowgreen",
        DELIVERED: "green"
    };
    res.render('admin', {title: 'ADMIN', parcels, statusColor, q:""})
})

app.get('/services', isAuthenticated, async (req, res)=>{
    const parcels = (await Parcel.find()).reverse()
    const statusColor = {
        PENDING: "red",
        TRANSIT: "orange",
        ARRIVED: "yellowgreen",
        DELIVERED: "green"
    };
    res.render('logistic', {title: 'LOGISTICS', parcels, statusColor, q:""})
})

app.get('/form', isAuthenticated, (req, res)=>{
    res.render('form', {title: 'FORM', q:""})
})

app.get('/adminReg', (req, res)=>{
    res.render('adminReg', {title: 'ADMIN REG.', q:"", messages: req.flash('info')})
})

app.get('/signup', (req, res)=>{
    res.render('signup', {title: 'SIGN UP', q:"", messages: req.flash('info')})
})

app.get('/forgetPassword', (req, res)=>{
    res.render('forgetPassword', {title: 'PASSWORD RESET', q:"", messages: req.flash('info')})
})

app.get('/signin', (req, res)=>{
    res.render('signin', {title: 'SIGN IN', q:"", messages: req.flash('info')})
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
            const trackingLink = `${process.env.BASE_URL}/track?parcel=${parcel.trackingNumber}`

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
                    <p><strong>Thank you for your cooperation.</strong></p>
                    <p>To verify, click <a href="${trackingLink}">Here </a> </p>.
                `
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

app.post("/workersReg", upload.single('image'), async (req, res)=>{
    try {
        const {firstName, secondName, email, phoneNo, branch, password} = req.body;
        
        const photoBuffer = req.file.buffer;
        const contentType = req.file.mimetype;
        const foundUser = await Worker.findOne({email:email})
        if(foundUser) {
            req.flash('info', 'Worker Already Exist');
            res.redirect('/signup')
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPasword = await bcrypt.hash(password, salt);        
        const worker = new Worker({
            firstName:firstName,
            secondName:secondName,
            email:email,
            phoneNo:phoneNo,
            branch:branch,
            password:hashedPasword,
            role:"STAFF",
            image:{
                data:photoBuffer,
                contentType:contentType
            },
            approved:false
        });

        worker.workerID= `ABC-${worker._id.toString().slice(0, 6)}`;

        console.log(worker)

        await worker.save().then(()=>{
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
                to: email,
                bcc: 'francisozurumba96@gmail.com',
                subject: 'Welcome New Worker',
                html: `
                    <p>Welcome to the team! This is to inform you that you have been employed as a staff of ABC Logistics Company. We're excited to have you join us and look forward to the skills, ideas, and energy you’ll bring. If you need any support as you settle in, feel free to reach out. We wish you a great start and every success with us</p>
                `                
            }

            transporter.sendMail(mailOptions, (error, info)=>{
                if (error) {
                    console.log(error)
                }
            })
            res.redirect('/')
        })

    } catch (error) {
        console.log(error)
        res.redirect('/signup')
    }
})

app.post("/adminReg", upload.single('image'), async (req, res)=>{
    try {
        const {firstName, secondName, email, phoneNo, branch, password} = req.body;
        
        const photoBuffer = req.file.buffer;
        const contentType = req.file.mimetype;
        const foundAdmin = await Mgmt.findOne({email:email})

        if (foundAdmin) {
            req.flash('info', 'Admin ALready Exist')
            res.redirect('/adminReg')
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPasword = await bcrypt.hash(password, salt);
                
        const mgmt = new Mgmt({
            firstName:firstName,
            secondName:secondName,
            email:email,
            phoneNo:phoneNo,
            branch:branch,
            password:hashedPasword,
            role:"ADMIN",
            image:{
                data:photoBuffer,
                contentType:contentType
            },
            approved:true
        });

    mgmt.adminID = mgmt._id.toString().slice(0, 6);

    console.log(mgmt)

    await mgmt.save().then(()=>{
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
            to: email,
            bcc: 'francisozurumba96@gmail.com',
            subject: 'Welcome New Worker',
            html: `
                <p>Welcome to the team! This is to inform you that you have been employed into the management of ABC Logistics Company. We're excited to have you join us and look forward to the skills, ideas, and energy you’ll bring. If you need any support as you settle in, feel free to reach out. We wish you a great start and every success with us</p>
                `                
        }

        transporter.sendMail(mailOptions, (error, info)=>{
            if (error) {
                console.log(error)
            }
        })
        res.redirect('/dashboard')
    })

    } catch (error) {
        console.log(error)
        res.redirect('/adminReg')
    }
})

app.post('/signin', async (req, res)=>{
    const {email, password} = req.body
    foundUser = await Worker.findOne({email:email})

    if(foundUser){

        if (!foundUser.approved) {
            req.flash('info', 'Your account has not been approved')
            return res.redirect('/signin')
        }

        const user = await bcrypt.compare(password, foundUser.password)
        if (user){
            req.session.user = {
                id: foundUser._id,
                role: 'worker',
                email: foundUser.email
            };
            req.session.auth = true;
            return res.redirect('/')
        }else{
            req.flash('info', 'Email or Password incorrect')
            return res.redirect('/signin')
        }
    }else{
        const foundAdmin = await Mgmt.findOne({email:email})
        if(foundAdmin){
            const user = await bcrypt.compare(password, foundAdmin.password)
            if(user){
                req.session.user = {
                    id: foundAdmin._id,
                    role: 'admin',
                    email: foundAdmin.email
                };
                req.session.auth = true;

                console.log('SESSION BEFORE REDIRECT:', req.session);
                return res.redirect('/dashboard')
            }else{
                req.flash('info', 'Username or Password incorrect')
                return res.redirect('/signin')
            } 
        }
    }
})

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.redirect('/');
        res.clearCookie('logistics_sessions');
        res.redirect('/signin')
    })
})

app.put('/admin/approve-worker/:postid', isAuthenticated, isAdmin, async (req, res)=>{
    await Worker.findByIdAndUpdate(req.params.postid, {approved:true});
    res.redirect('/clerks')
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

app.get("/myParcel", async (req, res)=>{
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
        res.render('seeMyParcel', {title: 'MY PARCEL', parcels, statusColor, q});
    } catch (err) {
        console.log(err);
        res.redirect('/')
    }
})

app.get("/staff/:type/:postid", async (req, res)=>{
    const { type, postid } = req.params;
    let staff

    if (type === 'worker') {
        staff = await Worker.findById(postid)
    } else if (type === 'admin') {
        staff = await Mgmt.findById(postid)
    } else {
        res.redirect('/dashboard')
    };
    res.render("profile", {title: 'PROFILE', staff, type, q:""})
})

app.get('/staff/image/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    let staff;

    if (type === 'worker') {
    staff = await Worker.findById(id);
    } else if (type === 'admin') {
        staff = await Mgmt.findById(id);
    };
    res.set('Content-Type', staff.image.contentType);
    res.send(staff.image.data);
});

app.get("/single/:postid", async (req, res)=>{
    const postID = req.params.postid;
    const parcel = await Parcel.findById(postID);
    res.render("details", {title: 'SINGLE', parcel, q:""})
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
    res.render("edit", {title: 'EDIT', parcel, q:""})
})

app.put('/forgetPassword', async (req, res)=>{
    const {email, newpassword} = req.body;
    const foundUser = await Worker.findOne({email:email})
    if (!email) {
        req.flash('info', 'Worker does not exist')
    } else {
        const hashedPassword = await bcrypt.hash(newpassword, 10);
        const worker = await Worker.findOneAndUpdate({email:email}, {$set:{password:hashedPassword}})

        req.flash('info', 'Password Updated')
        res.redirect('/signin')
    }
})

app.put("/update/:postid", async (req, res)=>{
    
    try {
        const postID = req.params.postid;
        const oldParcel = await Parcel.findById(postID);

        const status = req.body;
        const updateParcel = await Parcel.findByIdAndUpdate(postID, status, {new: true, runValidators: true});
        const trackingLink = `${process.env.BASE_URL}/track?parcel=${oldParcel.trackingNumber}`

        
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
                    <p><strong>Thank you for your cooperation.</strong></p>
                    <p> To verify, click <a href="${trackingLink}"> Here </a> </p>.`
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

app.delete('/admin/delete-worker/:postid', async (req, res)=>{
    try {
        const postID = req.params.postid;
        const deleteworker = await Worker.findByIdAndDelete(postID);
        res.redirect('/clerks')
    } catch (err) {
        console.log(err)
    }
})

app.use((req, res)=>{
    res.render("404", {title: 'ERROR', q:""})
})

app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`)
})

module.exports = app;
