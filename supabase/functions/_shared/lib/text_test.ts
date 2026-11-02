import { assertEquals } from "jsr:@std/assert@1";
import { detectCasual, extractServings, stripMarkdown } from "./text.ts";

Deno.test("detectCasual recognises greetings/thanks/farewells", () => {
  assertEquals(detectCasual("Привет!"), "greeting");
  assertEquals(detectCasual("добрый вечер"), "greeting");
  assertEquals(detectCasual("Спасибо большое"), "gratitude");
  assertEquals(detectCasual("Ну всё, пока"), "farewell");
});

Deno.test("detectCasual returns null for culinary requests", () => {
  assertEquals(detectCasual("хочу борщ"), null);
  assertEquals(detectCasual("курица, рис, лук"), null);
});

Deno.test("extractServings pulls the portion count", () => {
  assertEquals(extractServings("паста карбонара на 4 человека"), 4);
  assertEquals(extractServings("суп на 2 порции"), 2);
  assertEquals(extractServings("просто борщ"), null);
});

Deno.test("stripMarkdown removes asterisks and heading markers", () => {
  assertEquals(stripMarkdown("**жирный** текст"), "жирный текст");
  assertEquals(stripMarkdown("## Заголовок"), "Заголовок");
});
