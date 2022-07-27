const puppeteer = require("puppeteer");
const fs = require("fs");
const dotenv = require("dotenv");

// reading all .env files
dotenv.config();
const { ACC, PASS, QUERY, IP, ITEM_COUNT } = process.env;

// Setting
const setting = {
  HEADLESS: false,
  loginUrl: `https://www.facebook.com`,
  targetUrl: `https://www.facebook.com/search/pages/?q=${QUERY}`,
  proxy: `https://${IP}`,
};

console.log(ACC, PASS, QUERY, ITEM_COUNT);

// Helper function

function extractItems() {
  const extractedElements = document.querySelectorAll(
    '[role="feed"] > [role="article"] > div > div > div > div > div > div > div > div > div > div > div > span > div > a'
  );
  const items = [];
  for (let element of extractedElements) {
    items.push(element.href);
  }
  return items;
}

async function scrapeItems(page, extractItems, itemCount, scrollDelay = 800) {
  let items = [];
  try {
    let previousHeight;
    while (items.length < itemCount) {
      items = await page.evaluate(extractItems);
      previousHeight = await page.evaluate("document.body.scrollHeight");
      await page.evaluate(
        "window.scrollTo({top:document.body.scrollHeight,left:0,behavior:'smooth'})"
      );
      await page.waitForFunction(
        `document.body.scrollHeight > ${previousHeight}`
      );
      await page.waitForTimeout(scrollDelay);
    }
  } catch (e) {}
  return items;
}

async function collectInfo(page, hrefs) {
  const items = [];
  try {
    let previousHeight;

    for (const href of hrefs) {
      await page.goto(href, {
        waitUntil: "load",
        timeout: 0,
      });

      previousHeight = await page.evaluate("document.body.scrollHeight");
      await page.evaluate(
        "window.scrollTo({top:document.body.scrollHeight,left:0,behavior:'smooth'})"
      );
      await page.waitForFunction(
        `document.body.scrollHeight > ${previousHeight}`
      );
      await page.waitForTimeout(800);

      const data = await page.evaluate(() => {
        // get title
        const title =
          document.querySelector(
            ".d2edcug0.hpfvmrgz.qv66sw1b.c1et5uql.oi732d6d.ik7dh3pa.ht8s03o8.a8c37x1j.fe6kdd0r.mau55g9w.c8b282yb.keod5gw0.nxhoafnm.aigsh9s9.ns63r2gh.rwim8176.m6dqt4wy.h7mekvxk.hnhda86s.oo9gr5id.hzawbc8m > span"
          )?.textContent ||
          document.querySelector(
            ".d2edcug0.hpfvmrgz.qv66sw1b.c1et5uql.oi732d6d.ik7dh3pa.ht8s03o8.a8c37x1j.fe6kdd0r.mau55g9w.c8b282yb.keod5gw0.nxhoafnm.aigsh9s9.embtmqzv.h6olsfn3.mhxlubs3.p5u9llcw.hnhda86s.oo9gr5id.hzawbc8m > div > .gmql0nx0.l94mrbxd.p1ri9a11.lzcic4wl"
          )?.textContent ||
          "查無資料";

        //   get phone number
        const icons = document.querySelectorAll(
          ".d2edcug0.hpfvmrgz.qv66sw1b.c1et5uql.oi732d6d.ik7dh3pa.ht8s03o8.jq4qci2q.a3bd9o3v.b1v8xokw.oo9gr5id"
        );
        let phone = "查無資料";
        for (let icon of icons) {
          if (/^[0-9 ]+$/.test(icon.textContent)) {
            phone = icon.textContent;
          }
        }

        return {
          title,
          phone,
        };
      });

      items.push(data);
    }
  } catch (e) {}
  return items;
}

// Entry Point
async function main() {
  const { HEADLESS, loginUrl, targetUrl } = setting;

  const browser = await puppeteer.launch({
    headless: HEADLESS,
    userDataDir: "./userData",
    ignoreDefaultArgs: ["--disable-extensions"],
    // args: [`--proxy-server=${proxy(ip)}`],
  });

  const page = await browser.newPage();

  let currentScreen = await page.evaluate(() => {
    return {
      width: window.screen.availWidth,
      height: window.screen.availHeight,
    };
  });
  await page.setViewport(currentScreen);

  await page.authenticate();
  await page.goto(loginUrl);

  const conditional = await page.evaluate(() =>
    document.querySelector('[data-testid="royal_login_button"]')
  );

  if (conditional) {
    await page.focus("#email");
    await page.type("#email", ACC);
    await page.focus("#pass");
    await page.type("#pass", PASS);
    await page.click('[data-testid="royal_login_button"]');
    await page.waitForNavigation();
  }

  await page.goto(targetUrl);

  const hrefs = await scrapeItems(page, extractItems, ITEM_COUNT);
  const infos = await collectInfo(page, hrefs);

  fs.writeFileSync(`./${QUERY}.json`, JSON.stringify(infos));

  console.log("done!");

  await browser.close();
}

main();
