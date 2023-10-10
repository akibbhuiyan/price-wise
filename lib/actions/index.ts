"use server";
import { revalidatePath } from "next/cache";
import Product from "../models/product.model";
import { connectToDB } from "../mongoose";
import { scrapeAmazonProduct } from "../scraper";
import { getAveragePrice, getHighestPrice, getLowestPrice } from "../utils";
import { generateEmailBody, sendEmail } from "../nodemailer";
import { User } from "@/types";

export async function scrapAndStoreProduct(productUrl: string) {
  if (!productUrl) return;

  try {
    connectToDB();
    const scrapeProduct = await scrapeAmazonProduct(productUrl);

    if (!scrapeProduct) return;

    let product = await scrapeProduct;
    const existingProduct = await Product.findOne({ url: scrapeProduct.url });
    if (existingProduct) {
      const updatedPriceHistory: any = [
        ...existingProduct.priceHistory,
        { price: scrapeProduct.currentPrice },
      ];
      product = {
        ...scrapeProduct,
        priceHistory: updatedPriceHistory,
        lowestPrice: getLowestPrice(updatedPriceHistory),
        highestPrice: getHighestPrice(updatedPriceHistory),
        averagePrice: getAveragePrice(updatedPriceHistory),
      };
    }
    const newProduct = await Product.findOneAndUpdate(
      {
        url: scrapeProduct.url,
      },
      product,
      { upsert: true, new: true }
    );

    revalidatePath(`/products/${newProduct._id}`);
  } catch (error: any) {
    console.log(error);

    throw new Error(`Failed to creates/update Product:${error.message}`);
  }
}

export async function getProductById(productId: string) {
  try {
    connectToDB();
    const product = await Product.findOne({ _id: productId });
    if (!product) return null;
    return product;
  } catch (error: any) {
    console.log(`find productbyid:${error.message}`);
  }
}
export async function getAllProduct() {
  try {
    connectToDB();
    const product = await Product.find();
    if (!product) return null;
    return product;
  } catch (error: any) {
    console.log(`find product:${error.message}`);
  }
}
export async function getSimilarProduct(productId: string) {
  try {
    connectToDB();
    const currentProduct = await Product.findById(productId);
    if (!currentProduct) return null;
    const similarProduct = await Product.find({
      _id: { $ne: productId },
    }).limit(3);
    return similarProduct;
  } catch (error: any) {
    console.log(`find product:${error.message}`);
  }
}

export async function addUserEmailToProduct(
  productId: string,
  userEmail: string
) {
  try {
    connectToDB();
    const product = await Product.findById(productId);
    if (!product) return null;
    const userExist = product.users.some(
      (user: User) => user.email === userEmail
    );
    if (!userExist) {
      product.users.push({ email: userEmail });
      await product.save();
      const emailContent = await generateEmailBody(product, "WELCOME");
      await sendEmail(emailContent, [userEmail]);
    }
  } catch (error: any) {
    console.log(error);
  }
}
