import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

const channelSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '', maxlength: 100 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

const messageSchema = new Schema(
  {
    channel: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);
// History is always read newest-first per channel
messageSchema.index({ channel: 1, createdAt: -1 });

export const User = model('User', userSchema);
export const Channel = model('Channel', channelSchema);
export const Message = model('Message', messageSchema);

// Shapes sent to the browser (never the password hash)
export const userDto = (u) => ({ id: String(u._id), name: u.name });
export const channelDto = (c) => ({ id: String(c._id), name: c.name, description: c.description });
export const messageDto = (m) => ({
  id: String(m._id),
  channelId: String(m.channel),
  text: m.text,
  createdAt: m.createdAt,
  user: userDto(m.user),
});
