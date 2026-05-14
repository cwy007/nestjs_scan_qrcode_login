import { repl } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const replServer = await repl(AppModule);
  replServer.setupHistory(".repl_history", (err) => {
    if (err) {
      console.error("Error setting up REPL history:", err);
    }
  });
}
bootstrap();
