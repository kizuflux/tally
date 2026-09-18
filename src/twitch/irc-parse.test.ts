import { describe, expect, it } from "vitest";
import { parseIrcDisplayName, parseIrcLine } from "./irc-parse.ts";

describe("parseIrcLine", () => {
  it("parses PING", () => {
    expect(parseIrcLine("PING :tmi.twitch.tv")).toEqual({
      type: "ping",
      token: ":tmi.twitch.tv",
    });
  });

  it("parses PRIVMSG", () => {
    const event = parseIrcLine(
      ":baller!baller@baller.tmi.twitch.tv PRIVMSG #streamer :ultra the shiny",
    );
    expect(event).toEqual({
      type: "privmsg",
      author: "baller",
      channel: "#streamer",
      text: "ultra the shiny",
    });
  });

  it("parses tagged PRIVMSG and display-name", () => {
    const raw =
      "@badge-info=;display-name=Baller;user-type= :baller!baller@baller.tmi.twitch.tv PRIVMSG #x :hello";
    const event = parseIrcLine(raw);
    expect(event.type).toBe("privmsg");
    if (event.type === "privmsg") expect(event.text).toBe("hello");
    expect(parseIrcDisplayName(raw)).toBe("Baller");
  });
});
