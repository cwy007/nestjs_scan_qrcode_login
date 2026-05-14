import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtModule } from '@nestjs/jwt';
import { AaaModule } from './aaa/aaa.module';
import { BbbModule } from './bbb/bbb.module';

@Module({
  imports: [
    JwtModule.register({
      secret: 'foobar'
    }),
    AaaModule,
    BbbModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
