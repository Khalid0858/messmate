import nodemailer from "nodemailer";
import { put as putBlob, get as getBlob } from "@vercel/blob";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { DomainError } from "./domain.ts";
export function mailReady() {
  return !!(
    (process.env.SMTP_HOST || process.env.RESEND_API_KEY) &&
    process.env.MAIL_FROM
  );
}
export async function sendMail(to: string, subject: string, message: string) {
  if (!mailReady())
    throw new DomainError(
      "Email service is not configured. Contact the operator.",
      503,
    );
  if (process.env.RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [to],
        subject,
        text: message,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok)
      throw new DomainError(
        "Email delivery could not be accepted. Please retry later.",
        503,
      );
    return (await r.json() as { id: string }).id;
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === "465",
    requireTLS: process.env.SMTP_PORT !== "465",
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  const delivered = await transport.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text: message,
  });
  return delivered.messageId;
}
export const smsReady = () =>
  !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM
  );
export async function sendSms(to: string, message: string) {
  if (!smsReady()) throw new DomainError("SMS provider is not configured", 503);
  const account = process.env.TWILIO_ACCOUNT_SID!;
  const r = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(account)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${account}:${process.env.TWILIO_AUTH_TOKEN}`).toString(
            "base64",
          ),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: process.env.TWILIO_FROM!,
        Body: message,
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!r.ok) throw new DomainError("SMS provider rejected the request", 503);
  const body = (await r.json()) as { sid: string };
  return body.sid;
}
export function storage() {
  if (
    !process.env.S3_BUCKET ||
    !process.env.S3_ACCESS_KEY ||
    !process.env.S3_SECRET_KEY
  )
    throw new DomainError("Private file storage is not configured", 503);
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
  });
}
export async function putFile(key: string, bytes: Buffer, contentType: string) {
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
    await putBlob(key, bytes, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: false });
    return;
  }
  await storage().send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }),
  );
}
export async function getFile(key: string) {
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
    const result = await getBlob(key, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) throw new DomainError("File not found", 404);
    return { Body: { transformToByteArray: async () => new Uint8Array(await new Response(result.stream).arrayBuffer()) } };
  }
  return storage().send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
}
