import { AuthService } from "../auth/service";
import { UserRepository } from "../users/repository";


export const userRepository = new UserRepository();
export const authService = new AuthService(userRepository);