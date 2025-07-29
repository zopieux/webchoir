export interface Song {
    name: string;
    urls: string[];
}

function url(stem: string, ext: string = "opus"): string[] {
    return [`/songs/${stem}.${ext}`]
}
function urls(stem: string, ext: string = "opus"): string[] {
    return ["music", "vocals"].map(s => `/songs/${stem}.${s}.${ext}`)
}

export default function getAvailableSongs(): Song[] {
    return [
        { name: "Ave Verum Corpus, K. 618", urls: urls("ave-verum-corpus") },
        { name: "Cantique de Jean Racine", urls: urls("cantique-jean-racine") },
        { name: "Va pensiero", urls: urls("va-pensiero") },
        { name: "Va pensiero", urls: url("va-pensiero") },
        { name: "Seasons of Love", urls: urls("seasons") },
        { name: "The Ground", urls: urls("the-ground") },
    ].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }))
}
