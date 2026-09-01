import { BadRequestException } from "@nestjs/common";

export function cloudinaryUploadConfig(folder = "dreamdrive/kyc") {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new BadRequestException("Cloudinary is not configured");
  }
  return {
    cloudName,
    uploadPreset,
    folder,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
  };
}

export function publicClientConfig() {
  return {
    firebase: {
      apiKey: process.env.FIREBASE_API_KEY ?? "",
      authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? "",
      projectId: process.env.FIREBASE_PROJECT_ID ?? "",
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? "",
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? "",
      appId: process.env.FIREBASE_APP_ID ?? "",
      measurementId: process.env.FIREBASE_MEASUREMENT_ID ?? "",
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
      uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET ?? "",
    },
  };
}
