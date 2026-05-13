import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { randomUUID } from 'crypto';
import * as qrcode from 'qrcode';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('qrcode/generate')
  async generateQRCode() {
    const uuid = randomUUID();
    const url = `http://192.168.1.2:3000/pages/confirm.html?id=${uuid}`;
    const dataUrl = await qrcode.toDataURL(url);
    return {
      qrcode_id: uuid,
      img: dataUrl,
    }
  }
}
