import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Param,
  Patch,
  UnauthorizedException,
} from '@nestjs/common';

import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(
    @Body()
    body: {
      telegramId: string;
      username?: string;
      displayName?: string;
      language?: string;
    },
  ) {
    const user = await this.usersService.registerUser(body);

    return {
      success: true,
      message: 'User registered successfully',

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

  @Get(':telegramId')
async getUser(
  @Param('telegramId') telegramId: string,
) {
  const user =
    await this.usersService.getUserByTelegramId(
      telegramId,
    );

  if (!user) {
    return {
      success: false,
      message: 'User not found',
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

  @Get('admin/stats')
  async getAdminStats(
    @Headers('x-admin-key') adminKey: string,
  ) {
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      throw new UnauthorizedException('Access denied');
    }

    return this.usersService.getAdminStats();
  }

  @Patch(':telegramId/phone')
async updatePhone(
  @Param('telegramId') telegramId: string,
  @Body() body: { phoneNumber: string },
) {
  const user =
    await this.usersService.updatePhoneNumber(
      telegramId,
      body.phoneNumber,
    );

  return {
    success: true,
    message: 'Phone number updated successfully',
    phoneNumber: user.phoneNumber,
  };
}


}