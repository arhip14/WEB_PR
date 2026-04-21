const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: {
        type: String,
        enum: ['driver', 'station_operator', 'network_admin'],
        default: 'driver'
    }
});

module.exports = mongoose.model('User', userSchema);