import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { randomUUID } from 'crypto';
import * as qrcode from 'qrcode';

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

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('qrcode/generate')
  async generateQRCode() {
    const uuid = randomUUID();
    const url = `http://192.168.1.2:3000/pages/confirm.html?id=${uuid}`;
    const dataUrl = await qrcode.toDataURL(url);
    map.set(`qrcode_$uuid`, {
      status: StatusEnum.NoScan,
    })

    return {
      qrcode_id: uuid,
      img: dataUrl,
    }
  }
}
