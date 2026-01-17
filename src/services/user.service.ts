import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
dotenv.config({
    path: "./.env"
})
import { ApiError } from "../utils/ApiError.js";
import bcrypt from "bcrypt"

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
})
const prisma = new PrismaClient({ adapter });

const createUserService = async (username: string, email: string, password: string, fname: string, lname: string) => {

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
        data: {
            username,
            email,
            password: passwordHash,
            fname,
            lname
        },

        select: {
            id: true,
            fname: true,
            lname: true,
            username: true,
            email: true,
        }
    })
}

const loginUserService = async (identifier: string, password: string) => {

    const isEmail = identifier.includes("@");

    const user = await prisma.user.findUnique({
        where: isEmail ? { email: identifier } : { username: identifier }
    })

    if (!user) throw new ApiError({
        message: "Username or Password is Incorrect!",
        statusCode: 401,
        errorCode: "UNAUTHORIZED"
    })

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (isPasswordCorrect) {
        return { userId: user.id };
    } else {
        throw new ApiError({
            message: "Username or Password is Incorrect!",
            statusCode: 401,
            errorCode: "UNAUTHORIZED"
        })
    }
}


const selectUserService = async (id: string) => {
    if (!id) {
        throw new ApiError({
            message: "No User ID Found!",
            statusCode: 403,
            errorCode: "NOT_FOUND"
        })
    }
    await prisma.user.findUnique(
        {
            where: { id: id },
            select: {
                username: true,
                email: true,
                fname: true,
                lname: true,
                notes: true
            }
        })
}

const deleteUserService = async (requesterId: string, targetId: string) => {
    if (requesterId !== targetId) {
        throw new ApiError({
            message: "You don't have the required privilages to delete this user!",
            statusCode: 403,
            errorCode: "FORBIDDEN_REQUEST"
        })
    }
    await prisma.user.delete({
        where: { id: targetId }
    })
}

const updateUsernameService = async (id: string, newUsername: string) => {

    const currentUser = await prisma.user.findUnique({ where: { id: id }, select: { username: true } });

    if (!currentUser) {
        throw new ApiError({ statusCode: 404, errorCode: "NOT_FOUND", message: "User not found" });
    }

    if (newUsername === currentUser.username) {
        throw new ApiError({
            message: "New Username must be different than the Current Username!",
            statusCode: 400,
            errorCode: "VALIDATION_ERROR"
        });
    }

    const usernameTaken = await prisma.user.findUnique({
        where: { username: newUsername },
        select: { id: true }
    });

    if (usernameTaken) {
        throw new ApiError({
            statusCode: 409,
            errorCode: "CONFLICT",
            message: "Username already taken"
        });
    }

    await prisma.user.update({
        where: { id },
        data: { username: newUsername }
    });
}

const updateEmailService = async (newEmail: string, id: string, password: string) => {
    const currentUser = await prisma.user.findUnique({where: {id: id}, select: {email: true, password: true}})
    if(!currentUser){
        throw new ApiError({ statusCode: 404, errorCode: "NOT_FOUND", message: "User not found" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, currentUser.password);

    if(!isPasswordCorrect){
        throw new ApiError({ statusCode: 401, errorCode: "UNAUTHORIZED", message: "Incorrect Password!" });
    }

    const emailExists = await prisma.user.findUnique({where: { email: newEmail }, select: { id: true }});
    if(emailExists) {
        throw new ApiError({
            statusCode: 409,
            errorCode: "CONFLICT",
            message: "Email already exists."
        });
    }

    await prisma.user.update({where: { id }, data: { email: newEmail }});
}

const updatePasswordService = async (newPassword: string, id: string, currentPassword: string) => {
    const currentUser = await prisma.user.findUnique({where: {id}, select: {password: true}});
    if(!currentUser){
        throw new ApiError({ statusCode: 404, errorCode: "NOT_FOUND", message: "User not found" });
    }

    const isPasswordCorrect = await bcrypt.compare(currentPassword, currentUser.password);
    if(!isPasswordCorrect){
        throw new ApiError({ statusCode: 401, errorCode: "UNAUTHORIZED", message: "Incorrect Password!" });
    }

    if(newPassword === currentPassword){
        throw new ApiError({
            message: "New Password must not match the Old Password",
            statusCode: 400,
            errorCode: "VALIDATION_ERROR"
        });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({where: { id }, data: { password: hashedNewPassword }});
}