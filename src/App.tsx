import {
  createSignal,
  createEffect,
  createMemo,
  on,
  Show,
  type Accessor,
  type JSX,
  type Setter,
} from "solid-js";
import { createTween } from "@solid-primitives/tween";
import { defer } from "@solid-primitives/utils";
import { createShortcut } from "@solid-primitives/keyboard";
import type { WaveSurferOptions } from "wavesurfer.js";
import MultiTrack, { type TrackOptions } from "wavesurfer-multitrack";
type SingleTrackOptions = Omit<
  WaveSurferOptions,
  | "container"
  | "minPxPerSec"
  | "duration"
  | "cursorColor"
  | "cursorWidth"
  | "interact"
  | "hideScrollbar"
>;
import { usePDFSlick, type PDFSlickState } from "@pdfslick/solid";

import "./App.sass";
import getAvailableSongs, { type Song } from "./Songs";

function newTrack(
  id: number,
  url: string,
  options: SingleTrackOptions
): TrackOptions {
  return {
    id,
    url,
    startPosition: 0,
    draggable: false,
    volume: 1,
    options: { height: 50, ...options },
  };
}

const Track = {
  Music: 0,
  Vocals: 1,
} as const;
type Track = (typeof Track)[keyof typeof Track];

function createVolume(
  multitrack: Accessor<MultiTrack | undefined>,
  track: Track,
  initial: number
): [Accessor<number>, (value: number) => void] {
  const [volume, setVolume] = createSignal<number>(initial);
  const tween = createTween(volume, { duration: 300 });
  createEffect(
    defer(tween, (v) => {
      try {
        multitrack()?.setTrackVolume(track, v);
      } catch (e) {}
    })
  );
  return [volume, setVolume];
}

function Player({
  urls,
  isOpen,
  open,
}: {
  urls: Accessor<string[] | undefined>;
  isOpen: Accessor<boolean>;
  open: Setter<boolean>;
}) {
  let waveformEl, playButtonEl;
  const [isPlaying, setIsPlaying] = createSignal<boolean>(false);
  const [rate, setRate] = createSignal<number>(1.0);
  const [multitrack, setMultitrack] = createSignal<MultiTrack | undefined>(
    undefined
  );
  const [musicVolume, setMusicVolume] = createVolume(
    multitrack,
    Track.Music,
    1
  );
  const [vocalVolume, setVocalVolume] = createVolume(
    multitrack,
    Track.Vocals,
    1
  );
  const hasVocals = createMemo(() => urls()?.length == 2);
  createEffect(() => {
    if (!urls()) return;
    const [mUrl, vUrl] = urls()!;
    open(true);
    setTimeout(() => {
      if (multitrack()) {
        setMultitrack((m) => {
          // setVolumes(1, 1);
          setIsPlaying(false);
          m?.destroy();
          return undefined;
        });
      }
      const tracks = [
        newTrack(Track.Music, mUrl, {
          waveColor: "hsl(161, 80%, 50%)",
        }),
      ];
      if (hasVocals()) {
        tracks.push(
          newTrack(Track.Vocals, vUrl, {
            waveColor: "hsl(210, 80%, 50%)",
          })
        );
      }
      const m = MultiTrack.create(tracks, { container: waveformEl! });
      m.once("canplay", () => {
        setMultitrack(m);
        open(false);
      });
    }, 120);
  });

  const playPause = () => {
    multitrack()?.isPlaying() ? multitrack()?.pause() : multitrack()?.play();
    setIsPlaying(multitrack()?.isPlaying() ?? false);
  };

  const setVolumes = (music: number, vocals: number) => {
    setMusicVolume(music);
    setVocalVolume(vocals);
  };

  const hasVolume = (music: number, vocals: number) =>
    music === musicVolume() && vocals === vocalVolume();

  createShortcut(["a"], () => {
    setVolumes(1, 1);
  });
  createShortcut(["m"], () => {
    setVolumes(1, 0);
  });
  createShortcut(["v"], () => {
    setVolumes(0, 1);
  });
  createShortcut([" "], () => {
    playPause();
  });
  createShortcut(["r"], () => {
    setRate((r) => Math.max(0.25, r - 0.2));
  });
  createShortcut(["t"], () => {
    setRate(1);
  });
  createShortcut(["y"], () => {
    setRate((r) => Math.min(5.0, r + 0.2));
  });
  createEffect(() => {
    const r = rate();
    console.log("setting rate", r);
    // @ts-ignore
    multitrack()?.audios.forEach((audio) => {
      audio.playbackRate = r;
    });
  });

  const seekShortcut = (key: string[], amount: number) => {
    createShortcut(key, () => {
      multitrack()?.setTime(multitrack()?.getCurrentTime()! + amount);
    });
  };
  seekShortcut(["ArrowRight"], 1);
  seekShortcut(["Shift", "ArrowRight"], 10);
  seekShortcut(["ArrowLeft"], -1);
  seekShortcut(["Shift", "ArrowLeft"], -10);

  return (
    <dialog open={isOpen()}>
      <article>
        <header>
          <button
            aria-label="Close"
            /* @ts-ignore */
            rel="prev"
            onClick={() => open(false)}
          ></button>
          <p>
            <strong>Player</strong>
          </p>
        </header>
        <div role="group">
          <button
            ref={playButtonEl}
            id="play-btn"
            disabled={multitrack === undefined}
            onClick={playPause}
          >
            {isPlaying() ? "Pause" : "Play"}&nbsp;
            <span>{`${rate().toFixed(2)}×`}</span>
          </button>
        </div>
        <div role="group">
          <Show when={hasVocals()}>
            <button
              classList={{ outline: !hasVolume(1, 1), secondary: true }}
              onClick={() => setVolumes(1, 1)}
            >
              Music + Vocals
            </button>
            <button
              classList={{ outline: !hasVolume(1, 0), secondary: true }}
              onClick={() => setVolumes(1, 0)}
            >
              Music
            </button>
            <button
              classList={{ outline: !hasVolume(0, 1), secondary: true }}
              onClick={() => setVolumes(0, 1)}
            >
              Vocals
            </button>
          </Show>
        </div>
        <div id="waveform" ref={waveformEl}></div>
      </article>
    </dialog>
  );
}

function multipagePdf(
  url: string,
  pageViews: number = 1
): [
  widgets: JSX.Element[],
  isReady: Accessor<boolean>,
  setPageDelta: (i: number) => void
] {
  const widgets: JSX.Element[] = [],
    readies: Accessor<boolean>[] = [],
    stores: PDFSlickState[] = [];
  Array.from({ length: pageViews }).forEach((_) => {
    const {
      isDocumentLoaded,
      viewerRef,
      pdfSlickStore: store,
      PDFSlickViewer,
    } = usePDFSlick(url, {
      singlePageViewer: true,
      scaleValue: "page-fit",
    });
    readies.push(isDocumentLoaded);
    stores.push(store);
    widgets.push(<PDFSlickViewer {...{ store, viewerRef }} />);
  });
  const [isReady, setIsReady] = createSignal(false);
  let pageCount: number = 0;
  createEffect(
    on(readies, (readies) => {
      if (readies.every((v) => v === true)) {
        pageCount = stores[0].numPages;
        setIsReady(true);
        stores.forEach((store, index) => {
          store.pdfSlick?.gotoPage(index + 1);
        });
      }
    })
  );
  return [
    widgets,
    isReady,
    (delta: number) => {
      if (!isReady()) return;
      stores.forEach((store, index) => {
        const currentPage = store.pageNumber;
        let newPage = currentPage + delta;
        newPage = Math.max(newPage, index + 1);
        newPage = Math.min(newPage, pageCount - (pageViews - index - 1));
        if (newPage !== currentPage) store.pdfSlick?.gotoPage(newPage);
      });
    },
  ];
}

function App() {
  const [playerIsOpen, openPlayer] = createSignal(false);
  const [viewCount, setViewCount] = createSignal<number>(2);
  const [availableSongs, _setAvailableSongs] = createSignal<Song[]>(
    getAvailableSongs()
  );

  const [pdfUrl, setPdfUrl] = createSignal<string | undefined>(undefined);
  const [audioUrls, setAudioUrls] = createSignal<string[] | undefined>(
    undefined
  );
  const [widgets, setWidgets] = createSignal<JSX.Element[]>([]);

  const [setPageDelta, setSetPageDelta] = createSignal<(i: number) => void>(
    () => {}
  );

  createEffect(
    on([pdfUrl, viewCount], ([url, viewCount]) => {
      if (!url) return;
      const [widgets, _isPdfReady, setPageDelta] = multipagePdf(url, viewCount);
      setWidgets(widgets);
      setSetPageDelta(() => setPageDelta);
    })
  );

  createShortcut(["p"], () => openPlayer((p) => !p));
  createShortcut(["PageDown"], () => setPageDelta()(+2), {
    preventDefault: true,
  });
  createShortcut(["PageUp"], () => setPageDelta()(-2), {
    preventDefault: true,
  });
  createShortcut(["Shift", "PageUp"], () => setViewCount((v) => v + 1), {
    preventDefault: true,
  });
  createShortcut(
    ["Shift", "PageDown"],
    () => setViewCount((v) => Math.max(1, v - 1)),
    {
      preventDefault: true,
    }
  );

  const loadSound: JSX.EventHandler<HTMLSelectElement, Event> = (e) => {
    const index = parseInt(e.currentTarget.value);
    if (isNaN(index)) return;
    const urls = availableSongs()[index]?.urls;
    if (!urls) return;
    setAudioUrls(urls);
  };
  const loadPdf: JSX.EventHandler<HTMLInputElement, Event> = (e) => {
    if (!e.currentTarget.files || !e.currentTarget.files[0]) return;
    const file = e.currentTarget.files[0];
    const x = URL.createObjectURL(file);
    setPdfUrl(x);
  };

  return (
    <>
      <aside>
        <h1>
          WebChoir <small>by zopieux</small>
        </h1>
        <form class="grid" style="grid-template-columns: 1fr 1fr auto; align-items: center">
          <fieldset>
            <label>
              Audio
              <select onChange={loadSound}>
                <option>– Pick one –</option>
                {availableSongs().map((song, index) => (
                  <option value={index}>
                    {song.name}{" "}
                    {song.urls.length === 1
                      ? "(music only)"
                      : "(split music & vocals)"}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          <fieldset>
            <label>
              PDF file
              <input type="file" placeholder="PDF" onChange={loadPdf} />
            </label>
          </fieldset>
          <fieldset>
            <button
              onClick={(e) => {
                e.preventDefault();
                openPlayer(true);
              }}
            >
              Show player
            </button>
          </fieldset>
        </form>
      </aside>
      <main class="grid">
        {widgets().map((w) => (
          <div style="position: relative; overflow: hidden">{w}</div>
        ))}
      </main>
      <Player urls={audioUrls} isOpen={playerIsOpen} open={openPlayer} />
    </>
  );
}

export default App;
