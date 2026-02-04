import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  const authResponse = {
    accessToken: 'jwt-token',
    user: { id: 'uuid-1', email: 'john@test.com', name: 'John' },
  };

  describe('register', () => {
    it('should call authService.register and return result', async () => {
      mockAuthService.register.mockResolvedValue(authResponse);
      const dto = {
        name: 'John',
        email: 'john@test.com',
        password: 'password123',
        userName: 'johndoe',
      };

      expect(await controller.register(dto as any)).toEqual(authResponse);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should call authService.login with dto', async () => {
      mockAuthService.login.mockResolvedValue(authResponse);
      const dto = { username: 'johndoe', password: 'password123' };

      expect(await controller.login(dto)).toEqual(authResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
    });
  });

  describe('getProfile', () => {
    it('should return user from request', () => {
      const user = {
        id: 'uuid-1',
        email: 'john@test.com',
        toJSON: () => ({ id: 'uuid-1', email: 'john@test.com' }),
      };
      const req = { user };

      expect(controller.getProfile(req)).toEqual({ id: 'uuid-1', email: 'john@test.com' });
    });
  });
});
