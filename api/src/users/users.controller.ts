import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Param,
  Patch,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';

interface RegisterUserDto {
  telegramId: string;
  username?: string;
  displayName?: string;
  language?: string;
}

interface UpdatePhoneDto {
  phoneNumber: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post('register')
  async register(@Body() body: RegisterUserDto) {
    if (!body?.telegramId) {
      throw new BadRequestException('telegramId parametri kiritilmadi.');
    }

    const user = await this.usersService.registerUser(body);

    return {
      success: true,
      message: 'Foydalanuvchi muvaffaqiyatli saqlandi',
      user: {
        id: user.id,
        telegramId: user.telegramId.toString(),
        username: user.username,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        language: user.language,
      },
    };
  }

  @Get('admin/stats')
  async getAdminStats(@Headers('x-admin-key') adminKey: string) {
    const expectedKey = process.env.ADMIN_API_KEY;

    if (!expectedKey || !adminKey || adminKey !== expectedKey) {
      throw new UnauthorizedException('Kirish taqiqlandi: Noto‘g‘ri Admin API kalit');
    }

    return this.usersService.getAdminStats();
  }

  @Get(':telegramId')
  async getUser(@Param('telegramId') telegramId: string) {
    const user = await this.usersService.getUserByTelegramId(telegramId);

    if (!user) {
      return {
        success: false,
        message: 'Foydalanuvchi topilmadi',
        user: null,
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        telegramId: user.telegramId.toString(),
        username: user.username,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        language: user.language,
      },
    };
  }

  @Patch(':telegramId/phone')
  async updatePhone(
    @Param('telegramId') telegramId: string,
    @Body() body: UpdatePhoneDto,
  ) {
    if (!body?.phoneNumber) {
      throw new BadRequestException('phoneNumber parametri berilmadi.');
    }

    const user = await this.usersService.updatePhoneNumber(
      telegramId,
      body.phoneNumber,
    );

    return {
      success: true,
      message: 'Telefon raqam muvaffaqiyatli saqlandi',
      phoneNumber: user.phoneNumber,
    };
  }
}