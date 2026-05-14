import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { Observable, Subscriber } from 'rxjs';

let cache: any = null;

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  async getUniversityData() {
    if (cache) {
      return cache;
    }

    async function getData(observer: Subscriber<Record<string, any>>) {

      const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: {
          width: 0,
          height: 0
        }
      });

      const page = await browser.newPage();

      await page.goto('https://www.icourse163.org/university/view/all.htm');

      await page.waitForSelector('.u-usitys');

      const universityList: Array<Record<string, any>> = await page.$eval('.u-usitys', el => {
        return [...el.querySelectorAll('.u-usity')].map(item => {
          return {
            name: item.querySelector('img')!.alt,
            img: item.querySelector('img')!.src,
            link: item.getAttribute('href')
          }
        })
      });

      for (let i = 0; i < universityList.length; i++) {
        const item = universityList[i];
        await page.goto('https://www.icourse163.org' + item.link);

        await page.waitForSelector('.m-cnt');

        const content = await page.$eval('.m-cnt p', el => el.textContent);
        item.desc = content;

        observer.next({ data: item });

      }

      await browser.close();

      cache = universityList;
    }

    return new Observable((observer) => {
      getData(observer);
    });

  }
}
