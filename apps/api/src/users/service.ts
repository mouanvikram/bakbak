import UserRepository from "./repository";

class UserService {
    constructor(private userRepository: UserRepository){}

}

export const userService = new UserService(new UserRepository());
