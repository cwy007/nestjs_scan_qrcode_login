import { BadRequestException, Controller, Sse, Get, Headers, Header, Inject, Query, UnauthorizedException } from '@nestjs/common';
import { AppService } from './app.service';
import { randomUUID } from 'crypto';
import * as qrcode from 'qrcode';
import { JwtService } from '@nestjs/jwt';
import * as os from 'os';
import * as nodeDiskInfo from 'node-disk-info';

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


  // @Get('list')
  @Sse('list')
  async universityList() {
    return this.appService.getUniversityData();
  }

  @Get('status')
  async status() {
    return {
      cpu: this.getCpuInfo(),
      mem: this.getMemInfo(),
      dist: await this.getDiskStatus(),
      sys: this.getSysInfo()
    }
  }

  getSysInfo() {
    return {
      computerName: os.hostname(),
      computerIp: this.getServerIP(),
      osName: os.platform(),
      osArch: os.arch(),
    };
  }

  getServerIP() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  }


  async getDiskStatus() {
    const disks = await nodeDiskInfo.getDiskInfoSync();

    const sysFiles = disks.map((disk: any) => {
      return {
        dirName: disk._mounted,
        typeName: disk._filesystem,
        total: this.bytesToGB(disk._blocks) + 'GB',
        used: this.bytesToGB(disk._used) + 'GB',
        free: this.bytesToGB(disk._available) + 'GB',
        usage: ((disk._used / disk._blocks || 0) * 100).toFixed(2),
      };
    });
    return sysFiles;
  }


  bytesToGB(bytes) {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(2);
  }

  getMemInfo() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercentage = (((totalMemory - freeMemory) / totalMemory) * 100).toFixed(2);
    const mem = {
      total: this.bytesToGB(totalMemory),
      used: this.bytesToGB(usedMemory),
      free: this.bytesToGB(freeMemory),
      usage: memoryUsagePercentage,
    };
    return mem;
  }

  getCpuInfo() {
    const cpus = os.cpus();
    const cpuInfo = cpus.reduce(
      (info, cpu) => {
        info.cpuNum += 1;
        info.user += cpu.times.user;
        info.sys += cpu.times.sys;
        info.idle += cpu.times.idle;
        info.total += cpu.times.user + cpu.times.sys + cpu.times.idle;
        return info;
      },
      { user: 0, sys: 0, idle: 0, total: 0, cpuNum: 0 },
    );
    const cpu = {
      cpuNum: cpuInfo.cpuNum,
      sys: ((cpuInfo.sys / cpuInfo.total) * 100).toFixed(2),
      used: ((cpuInfo.user / cpuInfo.total) * 100).toFixed(2),
      free: ((cpuInfo.idle / cpuInfo.total) * 100).toFixed(2),
    };
    return cpu;
  }

}
