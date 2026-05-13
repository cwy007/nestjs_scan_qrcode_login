import { BadRequestException, Controller, Get, Headers, Inject, Query, UnauthorizedException } from '@nestjs/common';
import { AppService } from './app.service';
import { randomUUID } from 'crypto';
import * as qrcode from 'qrcode';
import { JwtService } from '@nestjs/jwt';

// 实际环境使用redis，这里简化处理
const map = new Map<string, QrCodeInfo>();

enum StatusEnum {
  NoScan = "no-scan", // 未扫描
  ScanWaitConfirm = "scan-wait-confirm", // 已扫描，等待用户确认
  ScanConfirm = "scan-confirm", // 已扫描，用户同意授权
  ScanCancel = "scan-cancel", // 已扫描，用户取消授权
  Expired = "expired" // 已过期
}

interface QrCodeInfo {
  status: StatusEnum
  userInfo?: {
    userId: number;
  }
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Inject(JwtService)
  private jwtService: JwtService;

  private users = [
    { id: 1, username: 'foo', password: '111' },
    { id: 2, username: 'bar', password: '222' },
  ];


  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('qrcode/generate')
  async generateQRCode() {
    const uuid = randomUUID();
    const url = `http://192.168.1.2:3000/pages/confirm.html?id=${uuid}`;
    const dataUrl = await qrcode.toDataURL(url);
    map.set(`qrcode_${uuid}`, {
      status: StatusEnum.NoScan,
    })

    return {
      qrcode_id: uuid,
      img: dataUrl,
    }
  }

  @Get('qrcode/check')
  async check(@Query('id') id: string) {
    const info = map.get(`qrcode_${id}`)!;
    if (info.status === 'scan-confirm') {
      return {
        token: await this.jwtService.sign({
          userId: info.userInfo?.userId
        }),
        ...info
      }
    }
    return info;
  }

  @Get('qrcode/scan')
  async scan(@Query('id') id: string) {
    const info = map.get(`qrcode_${id}`);
    console.log('scan id', id, info)
    if (!info) {
      throw new BadRequestException('二维码已过期');
    }
    info.status = StatusEnum.ScanWaitConfirm;
    return 'success';
  }

  @Get('qrcode/confirm')
  async confirm(@Query('id') id: string, @Headers('Authorization') auth: string) {
    let user;
    try {
      const [, token] = auth.split(' ');
      const info = await this.jwtService.verify(token);

      user = this.users.find(item => item.id == info.userId);
    } catch (e) {
      throw new UnauthorizedException('token 过期，请重新登录');
    }
    console.log('confirm id', id, user)

    const info = map.get(`qrcode_${id}`);
    if (!info) {
      throw new BadRequestException('二维码已过期');
    }
    info.status = StatusEnum.ScanConfirm;
    info.userInfo = user;
    return 'success';
  }

  @Get('qrcode/cancel')
  async cancel(@Query('id') id: string) {
    const info = map.get(`qrcode_${id}`);
    if (!info) {
      throw new BadRequestException('二维码已过期');
    }
    info.status = StatusEnum.ScanCancel;
    return 'success';
  }

  @Get('login')
  async login(@Query('username') username: string, @Query('password') password: string) {

    const user = this.users.find(item => item.username === username);

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    if (user.password !== password) {
      throw new UnauthorizedException('密码错误');
    }

    return {
      token: await this.jwtService.sign({
        userId: user.id
      })
    }
  }

  @Get('userInfo')
  async userInfo(@Headers('Authorization') auth: string) {
    try {
      const [, token] = auth.split(' ');
      const info = await this.jwtService.verify(token);

      const user = this.users.find(item => item.id == info.userId);
      return user;
    } catch (e) {
      throw new UnauthorizedException('token 过期，请重新登录');
    }
  }
}
