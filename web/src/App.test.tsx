import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import type { TimelineDocument } from "./types";

const timelineFixture: TimelineDocument = {
  schema_version: "1.0",
  source: {
    id: "doc-synthetic",
    text: "2024年1月10日に受診した。",
    dct: "2024-01-10",
    language: "ja",
    sha256: "synthetic-hash",
  },
  entities: [
    {
      id: "ent-001",
      label: "TIMEX3",
      text: "2024年1月10日",
      span: { start: 0, end: 10 },
      attributes: { type: "DATE" },
      is_dct: false,
    },
    {
      id: "ent-002",
      label: "cc",
      text: "受診",
      span: { start: 11, end: 13 },
      attributes: { state: "executed" },
      is_dct: false,
    },
  ],
  relations: [
    {
      id: "rel-001",
      type: "timeOn",
      source_id: "ent-002",
      target_id: "ent-001",
    },
  ],
  anchors: [
    {
      id: "time-001",
      entity_ids: ["ent-001"],
      texts: ["2024年1月10日"],
      value: "2024-01-10",
      precision: "day",
      resolution: "stated",
      is_dct: false,
    },
  ],
  items: [
    {
      id: "item-001",
      entity_id: "ent-002",
      text: "受診",
      label: "cc",
      category: "context",
      attributes: { state: "executed" },
      span: { start: 11, end: 13 },
      placement: {
        status: "point",
        start: null,
        end: null,
        point_anchor_ids: ["time-001"],
        alternative_anchor_ids: [],
        evidence_relation_ids: ["rel-001"],
      },
      anatomy_ids: [],
      modifier_ids: [],
      value_ids: [],
    },
  ],
  warnings: [
    {
      code: "reversed-interval",
      severity: "warning",
      message: "The interval starts after it ends.",
      entity_ids: ["ent-002"],
      relation_ids: ["rel-001"],
    },
  ],
  run: {
    annotator: "prism-annotator",
    annotator_version: "0.2.1",
    model: "openai/gpt-5-mini",
    phase_calls: 3,
    generated_at: "2026-07-22T00:00:00Z",
    persistence: "none",
    usage: {
      prompt_tokens: 100,
      completion_tokens: 20,
      total_tokens: 120,
      estimated_cost_usd: 0.0001,
    },
  },
};

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("defaults to Japanese and switches the complete interface to English", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: "ok" }) }),
    );

    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "臨床テキストを入力してください",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("診療記録などの医療文書から患者の経過を抽出し、時系列に可視化します。"),
    ).toBeInTheDocument();
    expect(await screen.findByText("プロバイダーキーが必要です")).toBeInTheDocument();
    expect(
      screen.getByText(
        "OpenRouterキーで利用できるモデル識別子（未検証モデルは結果品質が異なる場合があります）",
      ),
    ).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("lang", "ja");
    expect(document.title).toBe("HeaRT — Health Record Timeliner");
    expect(screen.getByRole("link", { name: "特許第7737703号" })).toHaveAttribute(
      "href",
      "https://jglobal.jst.go.jp/detail?JGLOBAL_ID=202503019605238486",
    );
    expect(screen.getByRole("link", { name: "GitHubで公開" })).toHaveAttribute(
      "href",
      "https://github.com/shuntaroy/HeaRT-LLM",
    );

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("heading", { name: "Enter clinical text" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Extract a patient's clinical course from medical documents such as clinical records and visualise it chronologically.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Provider key required")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Any model identifier available to your OpenRouter key; unvalidated models may produce different results",
      ),
    ).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(document.title).toBe("HeaRT — Health Record Timeliner");
  });

  it("renders a returned timeline without retaining a run history", async () => {
    const encoder = new TextEncoder();
    let releaseResult: () => void = () => undefined;
    const resultGate = new Promise<void>((resolve) => {
      releaseResult = resolve;
    });
    let readIndex = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/health") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: "ok" }) });
      }
      return Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              readIndex += 1;
              if (readIndex === 1) {
                return {
                  done: false,
                  value: encoder.encode(
                    `${JSON.stringify({
                      type: "progress",
                      phase: "entity",
                      completed: 1,
                      total: 3,
                    })}\n`,
                  ),
                };
              }
              if (readIndex === 2) {
                await resultGate;
                return {
                  done: false,
                  value: encoder.encode(
                    `${JSON.stringify({ type: "result", timeline: timelineFixture })}\n`,
                  ),
                };
              }
              return { done: true, value: undefined };
            },
          }),
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    expect(await screen.findByText("プロバイダーキーが必要です")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "プロバイダーキーを追加" }));
    fireEvent.change(screen.getByLabelText("OpenRouter APIキー"), {
      target: { value: "synthetic-browser-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "このキーを使用" }));
    fireEvent.click(screen.getByRole("button", { name: "作例で試す" }));
    fireEvent.click(screen.getByRole("button", { name: "タイムラインを作成" }));

    expect((await screen.findAllByText("医療関係を抽出中")).length).toBe(2);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(
      screen.getByRole("status", { name: "根拠をタイムラインに配置しています" }),
    ).toBeInTheDocument();
    await act(async () => releaseResult());

    expect(
      await screen.findByRole("heading", { name: "診療タイムライン" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("受診").length).toBeGreaterThan(0);
    expect(screen.getByText("保存").nextElementSibling).toHaveTextContent("なし");
    expect(screen.getByText("現在の文書")).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "根拠をタイムラインに配置しています" }),
    ).not.toBeInTheDocument();
    const warningSummary = screen.getByText("reversed-interval").closest("summary");
    expect(warningSummary).not.toBeNull();
    fireEvent.click(warningSummary!);
    expect(screen.getByText("期間の開始が終了より後になっています。")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "臨床テキストを入力してください" }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/timelines/stream",
      expect.objectContaining({ cache: "no-store", credentials: "omit" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "入力を編集" }));
    expect(
      screen.getByRole("heading", { name: "臨床テキストを入力してください" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("医療テキストを貼り付けてください"), {
      target: { value: "新しい合成文書" },
    });
    expect(
      screen.queryByRole("heading", { name: "診療タイムライン" }),
    ).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("新しい合成文書")).toBeInTheDocument();
  });

  it("does not present the Worker scaffold as an available analysis service", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "ok", analysis_available: false }),
      }),
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "作例で試す" }));

    expect(await screen.findByText("AI解析が無効です")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "解析サービスを利用できません" }),
    ).toBeDisabled();
  });

  it("explains a rejected model output without exposing the raw completion", async () => {
    const encoder = new TextEncoder();
    let readIndex = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/health") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: "ok" }) });
      }
      return Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              readIndex += 1;
              if (readIndex === 1) {
                return {
                  done: false,
                  value: encoder.encode(
                    `${JSON.stringify({
                      type: "error",
                      code: "source-text-mismatch",
                      message: "The model changed the source text, so entity spans are unsafe.",
                    })}\n`,
                  ),
                };
              }
              return { done: true, value: undefined };
            },
          }),
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await screen.findByText("プロバイダーキーが必要です");
    fireEvent.click(screen.getByRole("button", { name: "プロバイダーキーを追加" }));
    fireEvent.change(screen.getByLabelText("OpenRouter APIキー"), {
      target: { value: "synthetic-browser-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "このキーを使用" }));
    fireEvent.click(screen.getByRole("button", { name: "作例で試す" }));
    fireEvent.click(screen.getByRole("button", { name: "タイムラインを作成" }));

    expect(
      await screen.findByText("モデルが原文を変更したため、安全に分析を続行できません。"),
    ).toBeInTheDocument();
    const disclosureSummary = screen.getByText("停止理由を表示");
    const details = disclosureSummary.closest("details");
    expect(details).not.toHaveAttribute("open");
    fireEvent.click(disclosureSummary);
    expect(details).toHaveAttribute("open");
    expect(
      screen.getByText(
        "アノテーション記号を除いた出力は、原文の内部空白・句読点・文字順を含めて一字一句一致する必要があります。",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("raw model completion")).not.toBeInTheDocument();
  });

  it("keeps a user key in page memory and sends it outside the clinical JSON", async () => {
    const apiKey = "synthetic-browser-key";
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/health") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: "ok",
            analysis_available: true,
          }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          detail: { code: "provider-authentication-failed", message: "OpenRouter rejected the API key." },
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByText("プロバイダーキーが必要です")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "プロバイダーキーを追加" }));
    const keyInput = screen.getByLabelText("OpenRouter APIキー");
    expect(keyInput).toHaveAttribute("type", "password");
    fireEvent.change(keyInput, { target: { value: apiKey } });
    fireEvent.click(screen.getByRole("button", { name: "このキーを使用" }));

    expect(await screen.findByText("入力したキーで分析できます")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "作例で試す" }));
    fireEvent.click(screen.getByRole("button", { name: "タイムラインを作成" }));
    expect(await screen.findByText("OpenRouterがAPIキーを拒否しました。")).toBeInTheDocument();

    const analysisCall = fetchMock.mock.calls.find(([url]) => url === "/api/timelines/stream");
    expect(analysisCall).toBeDefined();
    const requestInit = analysisCall?.[1] as RequestInit;
    expect(new Headers(requestInit.headers).get("X-HeaRT-OpenRouter-Key")).toBe(apiKey);
    expect(String(requestInit.body)).not.toContain(apiKey);

    fireEvent.click(screen.getByRole("button", { name: "リセット" }));
    expect(await screen.findByText("プロバイダーキーが必要です")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "プロバイダーキーを追加" }));
    expect(screen.getByLabelText("OpenRouter APIキー")).toHaveValue("");
  });
});
