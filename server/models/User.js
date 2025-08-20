import mongoose, { mongo } from 'mongoose';

const userSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        unique: true,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        unique: true,
    },
    passwordHash: {
        type: String,
        required: true,
    },
    online: { type: Boolean, default: false },
    lastseen: { type: Date, default: Date.now },
    // profilePicture: {
    //     type: String,
    //     default:
    //         "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png",
    // },

}, { timestamps: true });

userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.passwordHash;
    return obj;
};

export const User = mongoose.model("User", userSchema);