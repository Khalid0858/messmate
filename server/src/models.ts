import mongoose, { Schema } from "mongoose";
const opts = { timestamps: true, minimize: false };
const user = new Schema(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true, select: false },
    verified: { type: Boolean, default: false },
    phone: String,
    smsConsent: { type: Boolean, default: false },
    authVersion: { type: Number, default: 0 },
  },
  opts,
);
const session = new Schema(
  {
    token: { type: String, unique: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    csrf: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    authVersion: Number,
  },
  opts,
);
session.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const ticket = new Schema(
  {
    token: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ["verify", "reset"], required: true },
    expiresAt: { type: Date, required: true },
  },
  opts,
);
ticket.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const mess = new Schema(
  {
    adminId: { type: String, required: true, index: true },
    userIds: { type: [String], default: [], index: true },
    data: { type: Schema.Types.Mixed, required: true },
    revision: { type: Number, default: 0 },
    legacyId: { type: String },
  },
  opts,
);
mess.index(
  { legacyId: 1 },
  { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } },
);
const upload = new Schema(
  {
    key: { type: String, unique: true, required: true },
    messId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true },
    contentType: String,
    size: Number,
  },
  opts,
);
export const User = mongoose.model<any>("User", user),
  Session = mongoose.model<any>("Session", session),
  Ticket = mongoose.model<any>("Ticket", ticket),
  Mess = mongoose.model<any>("Mess", mess),
  Upload = mongoose.model<any>("Upload", upload);
const bucket = new Schema({
  key: { type: String, unique: true, required: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
bucket.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RateBucket = mongoose.model<any>("RateBucket", bucket);
export async function connect(uri: string) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });
  await Promise.all([
    User.init(),
    Session.init(),
    Ticket.init(),
    Mess.init(),
    Upload.init(),
    RateBucket.init(),
  ]);
}
