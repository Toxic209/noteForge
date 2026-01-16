export class ApiResponse<T> {
    public readonly message: string
    public readonly data: T

    constructor({message, data}:{message: string, data: T}){
        this.message = message;
        this.data = data;
    }
}