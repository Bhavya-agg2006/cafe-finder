const { useState, useMemo, useEffect, useRef, useContext } = React;

/* ---------- Data ----------
   open / close are in 24-hour time. A close time past midnight
   is written as 24 + hour (2 AM = 26, 5 AM = 29).
   image: the photo path WITHOUT the extension. Photos go in the "img" folder,
   and .jpg / .jpeg / .png / .webp are all tried automatically.
   lat / lng: map position (approximate, at neighbourhood level).
   To make a pin exact: in Google Maps right-click the cafe and click the
   numbers at the top of the menu to copy them. */
const FILTERS = ["All", "Open now", "Late night", "Aesthetic", "Delhi", "Noida", "Gurugram"];

const cafes = [
  { id: 1, name: "The Big Chill Cafe", area: "Khan Market", city: "Delhi", open: 12, close: 23.5, tags: ["Iconic"], image: "img/big chill", lat: 28.6003, lng: 77.2273 },
  { id: 2, name: "Cafe Lota", area: "Pragati Maidan", city: "Delhi", open: 8, close: 21.5, tags: ["Aesthetic", "Heritage setting"], image: "img/cafe lota", lat: 28.615, lng: 77.243 },
  { id: 3, name: "Diggin Cafe", area: "Chanakyapuri", city: "Delhi", open: 11, close: 21.5, tags: ["Aesthetic"], image: "img/diggin", lat: 28.5905, lng: 77.1925 },
  { id: 4, name: "Triveni Terrace Cafe", area: "Mandi House", city: "Delhi", open: 10, close: 21.5, tags: ["Aesthetic", "Artsy"], image: "img/Triveni_Terrace", lat: 28.6242, lng: 77.234 },
  { id: 5, name: "Cha Bar", area: "Connaught Place", city: "Delhi", open: 10, close: 22, tags: ["Tea"], image: "img/char bar", lat: 28.6328, lng: 77.2195 },
  { id: 6, name: "Cafe Tesu", area: "Kalu Sarai", city: "Delhi", open: 8, close: 24, tags: ["Aesthetic", "Brunch"], image: "img/cafe tasu", lat: 28.5455, lng: 77.1995 },
  { id: 7, name: "Jugmug Thela", area: "Saidulajab / Saket", city: "Delhi", open: 11, close: 23, tags: ["Aesthetic", "Outdoor"], image: "img/jugmug-thela", lat: 28.5245, lng: 77.213 },
  { id: 8, name: "Greenr Cafe", area: "Vasant Vihar", city: "Delhi", open: 12.5, close: 22, tags: ["Aesthetic", "Healthy food"], image: "img/green cafe", lat: 28.559, lng: 77.1595 },
  { id: 9, name: "BBR Coffee by Before British Raj", area: "Siri Fort", city: "Delhi", open: 7, close: 23.5, tags: ["Coffee"], image: "img/bbr", lat: 28.5535, lng: 77.2155 },
  { id: 10, name: "TAN Coffee", area: "Connaught Place", city: "Delhi", open: 8, close: 25, tags: ["Coffee"], image: "img/tan coffee", lat: 28.6315, lng: 77.2167 },
  { id: 11, name: "Third Wave Coffee", area: "Connaught Place", city: "Delhi", open: 8, close: 25, tags: ["Coffee"], image: "img/third wave", lat: 28.63, lng: 77.219 },
  { id: 12, name: "Chelvies Coffee", area: "Connaught Place", city: "Delhi", open: 8.5, close: 26, tags: ["Coffee"], image: "img/chelvies", lat: 28.634, lng: 77.215 },
  { id: 13, name: "Timber Café Delhi", area: "Safdarjung Enclave", city: "Delhi", open: 13, close: 23, tags: ["Aesthetic"], image: "img/timber cafe", lat: 28.5675, lng: 77.198 },
  { id: 14, name: "Toffeebar Cafe and Dining", area: "Chanakyapuri", city: "Delhi", open: 9, close: 23.5, tags: ["Dining"], image: "img/toffeebar", lat: 28.5975, lng: 77.187 },
  // Cine Tree has no exact area in the list, so it is left off the map and distance sort
  { id: 15, name: "Cine Tree Cafe", area: "Delhi", city: "Delhi", open: 11, close: 29, tags: ["Open till 5 AM"], image: "img/cine tree", lat: null, lng: null },
  { id: 16, name: "Cafe Crew Brew", area: "NSP", city: "Delhi", open: 8, close: 26, tags: ["Coffee"], image: "img/cafe brew", lat: 28.696, lng: 77.152 },
  { id: 17, name: "Habidade", area: "Sector 104", city: "Noida", open: 10, close: 23.5, tags: ["Hours vary Mon/Tue"], image: "img/habidade", lat: 28.545, lng: 77.368 },
  { id: 18, name: "DiGhent Cafe", area: "Sector 28", city: "Gurugram", open: 8, close: 22.5, tags: ["Breakfast"], image: "img/di ghent", lat: 28.472, lng: 77.088 },
];

/* ---------- Helpers ---------- */
function formatTime(value) {
  const total = Math.round((value % 24) * 60);
  let h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h} ${suffix}` : `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

function isOpenAt(cafe, hourNow) {
  // Check today's hours, and also "yesterday's" hours that run past midnight
  return (
    (hourNow >= cafe.open && hourNow < cafe.close) ||
    (hourNow + 24 >= cafe.open && hourNow + 24 < cafe.close)
  );
}

function isLateNight(cafe) {
  return cafe.close >= 25; // closes at 1 AM or later
}

// Straight-line distance between two points on Earth, in km
function distanceKm(a, b) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function directionsUrl(cafe) {
  const query = `${cafe.name} ${cafe.area} ${cafe.city}`;
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
}

// Exact-location map for one cafe (Google Maps finds it by name, so it is more exact than our pins)
function mapEmbedUrl(cafe) {
  const query = `${cafe.name} ${cafe.area} ${cafe.city}`;
  return "https://www.google.com/maps?q=" + encodeURIComponent(query) + "&output=embed";
}

/* ---------- Things to do ----------
   Short descriptions come from your cafe list. Activities are suggestions based on
   the type of place (tags), not a guarantee of what each cafe offers. */
const VIBES = {
  1: "One of Delhi's iconic cafés.",
  2: "A beautiful cultural and heritage setting.",
  3: "A very popular aesthetic café.",
  4: "An artsy, relaxed atmosphere.",
  6: "Popular for coffee and brunch.",
  7: "A rustic, outdoor vibe.",
  8: "Greenery and healthy food.",
  13: "A contemporary, aesthetic look.",
  15: "Unusually, it stays open until 5 AM.",
};

function getActivities(cafe) {
  const has = (tag) => cafe.tags.includes(tag);
  const list = [];

  if (has("Aesthetic")) {
    list.push({ icon: "📸", title: "Click photos", text: "Good for ambience and pictures with friends." });
    list.push({ icon: "💑", title: "Plan a date", text: "A nice setting for a relaxed date." });
  }
  if (has("Heritage setting")) list.push({ icon: "🏛️", title: "Soak in the setting", text: "Enjoy the cultural and heritage surroundings." });
  if (has("Artsy")) list.push({ icon: "🎨", title: "Enjoy the art vibe", text: "A relaxed, artsy place to unwind." });
  if (has("Outdoor")) list.push({ icon: "🌿", title: "Sit outdoors", text: "Enjoy the open-air, rustic feel." });
  if (has("Healthy food")) list.push({ icon: "🥗", title: "Eat healthy", text: "Healthy food surrounded by greenery." });
  if (has("Brunch")) list.push({ icon: "🥞", title: "Brunch with friends", text: "A popular spot for brunch." });
  if (has("Breakfast")) list.push({ icon: "🍳", title: "Breakfast", text: "Start your day here." });
  if (has("Coffee")) list.push({ icon: "☕", title: "Try the coffee", text: "A good stop for coffee lovers." });
  if (has("Tea")) list.push({ icon: "🍵", title: "Have some tea", text: "Stop by for a cup of tea." });
  if (has("Dining")) list.push({ icon: "🍽️", title: "Sit down for a meal", text: "Cafe and dining in one place." });
  if (has("Iconic")) list.push({ icon: "⭐", title: "Visit an icon", text: "One of the best-known cafés in Delhi." });
  if (isLateNight(cafe)) list.push({ icon: "🌙", title: "Late-night hangout", text: `Open until ${formatTime(cafe.close)}.` });

  list.push({ icon: "👯", title: "Catch up with friends", text: "Grab a table and take your time." });
  return list.slice(0, 6);
}

/* ---------- Hook: search + filter + nearest sort ---------- */
function useCafeSearch(userPos, sortNearest) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  const results = useMemo(() => {
    const text = query.trim().toLowerCase();
    const now = new Date();
    const hourNow = now.getHours() + now.getMinutes() / 60;

    const list = cafes
      .filter((cafe) => {
        let matchesFilter = true;
        if (filter === "Open now") matchesFilter = isOpenAt(cafe, hourNow);
        else if (filter === "Late night") matchesFilter = isLateNight(cafe);
        else if (filter === "Aesthetic") matchesFilter = cafe.tags.includes("Aesthetic");
        else if (["Delhi", "Noida", "Gurugram"].includes(filter)) matchesFilter = cafe.city === filter;

        const searchable = `${cafe.name} ${cafe.area} ${cafe.city} ${cafe.tags.join(" ")}`.toLowerCase();
        return matchesFilter && searchable.includes(text);
      })
      .map((cafe) => ({
        ...cafe,
        distance: userPos && cafe.lat != null ? distanceKm(userPos, cafe) : null,
      }));

    if (sortNearest && userPos) {
      list.sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
    }
    return list;
  }, [query, filter, userPos, sortNearest]);

  return { query, setQuery, filter, setFilter, results };
}

/* ---------- Hook: visitor's location ---------- */
function useLocation() {
  const [pos, setPos] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ok | denied | unsupported

  const locate = () => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setStatus("ok");
      },
      () => setStatus("denied"),
      { timeout: 10000 }
    );
  };

  return { pos, status, locate };
}

/* ---------- Hook: reviews (talks to server.js) ---------- */
function useReviews() {
  const [reviews, setReviews] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ok | offline

  useEffect(() => {
    fetch("/api/reviews")
      .then((res) => {
        if (!res.ok) throw new Error("no server");
        return res.json();
      })
      .then((data) => {
        setReviews(data);
        setStatus("ok");
      })
      .catch(() => setStatus("offline"));
  }, []);

  async function addReview(review) {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(review),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not save your review.");
    setReviews((prev) => [data, ...prev]);
  }

  // Average rating and number of reviews for each cafe
  const stats = useMemo(() => {
    const result = {};
    reviews.forEach((r) => {
      const entry = result[r.cafeId] || (result[r.cafeId] = { sum: 0, count: 0, avg: 0 });
      entry.sum += r.rating;
      entry.count += 1;
      entry.avg = entry.sum / entry.count;
    });
    return result;
  }, [reviews]);

  return { reviews, status, addReview, stats };
}

/* ---------- Hook: dark / light theme ---------- */
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch (e) {}
    // First visit: follow the computer's setting
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  // Remember the choice for next time
  useEffect(() => {
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {}
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggleTheme };
}

/* ---------- Components ---------- */

// Used only if the server cannot list the photo files: each extension is tried in turn
const EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".JPG", ".JPEG", ".PNG", ".jfif"];

// undefined = still loading the photo list, null = server cannot list photos, array = photo files found
const ImagesContext = React.createContext(undefined);

function normalizeKey(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Finds the photo file for a cafe, ignoring capital letters, spaces, dashes and the extension
function findPhoto(cafe, files) {
  const key = normalizeKey(cafe.image.split("/").pop());
  const nameKey = normalizeKey(cafe.name);
  const entries = files.map((file) => ({
    file,
    base: normalizeKey(file.split("/").pop().replace(/\.[^.]+$/, "")),
  }));
  const exact = entries.find((e) => e.base === key || e.base === nameKey);
  if (exact) return exact.file;
  const partial = key.length >= 4 ? entries.find((e) => e.base.includes(key)) : null;
  return partial ? partial.file : null;
}

function useImageList() {
  const [files, setFiles] = useState(undefined);

  useEffect(() => {
    fetch("/api/images")
      .then((res) => {
        if (!res.ok) throw new Error("no list");
        return res.json();
      })
      .then((list) => setFiles(Array.isArray(list) ? list : null))
      .catch(() => setFiles(null));
  }, []);

  return files;
}

function CafeImage({ cafe, tall }) {
  const files = useContext(ImagesContext);
  const [attempt, setAttempt] = useState(0);
  const size = tall ? " tall" : "";

  // Still asking the server which photos exist
  if (files === undefined) {
    return <div className={"card-img placeholder" + size} aria-hidden="true" />;
  }

  let src = null;
  if (files === null) {
    if (attempt < EXTENSIONS.length) src = cafe.image + EXTENSIONS[attempt];
  } else if (attempt === 0) {
    src = findPhoto(cafe, files);
  }

  // No photo found: show a neat placeholder (hover it to see what was looked for)
  if (!src) {
    const initials = cafe.name.split(" ").slice(0, 2).map((w) => w[0]).join("");
    const wanted = cafe.image.split("/").pop();
    return (
      <div
        className={"card-img placeholder" + size}
        title={files ? `No photo found for "${wanted}" in the img folder` : `Looking for: ${cafe.image}.jpg (or .png / .webp)`}
        aria-label={`${cafe.name} (photo coming soon)`}
      >
        <span>☕</span>
        <small>{initials}</small>
      </div>
    );
  }

  return (
    <img
      className={"card-img" + size}
      src={encodeURI(src)}
      alt={`${cafe.name}, ${cafe.area}`}
      onError={() => setAttempt(attempt + 1)}
    />
  );
}

function Rating({ stat }) {
  if (!stat) return <span className="rating-none">No reviews yet</span>;
  return (
    <span className="rating">
      ★ {stat.avg.toFixed(1)} <small>({stat.count})</small>
    </span>
  );
}

function CafeCard({ cafe, stat, onOpenReviews }) {
  const now = new Date();
  const openNow = isOpenAt(cafe, now.getHours() + now.getMinutes() / 60);

  return (
    <article className="card clickable" onClick={() => onOpenReviews(cafe.id)}>
      <CafeImage cafe={cafe} />

      <div className="card-body">
        <div className="card-top">
          <h2>{cafe.name}</h2>
          <span className={openNow ? "badge open" : "badge closed"}>{openNow ? "Open now" : "Closed"}</span>
        </div>

        <div className="card-meta">
          <p className="area">📍 {cafe.area}, {cafe.city}</p>
          <Rating stat={stat} />
          {cafe.distance != null && <span className="distance">{formatDistance(cafe.distance)}</span>}
        </div>

        <div className="hours">
          <div>
            <small>Opens</small>
            <strong>{formatTime(cafe.open)}</strong>
          </div>
          <div>
            <small>Closes</small>
            <strong>{formatTime(cafe.close)}</strong>
          </div>
        </div>

        <ul className="tags">
          {cafe.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>

        <div className="card-actions">
          <button type="button" className="btn solid" onClick={() => onOpenReviews(cafe.id)}>
            View details
          </button>
          <a className="btn" href={directionsUrl(cafe)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            Directions
          </a>
        </div>
      </div>
    </article>
  );
}

function CafeDetail({ cafe, reviews, stat, serverStatus, onClose, onSubmit }) {
  const now = new Date();
  const openNow = isOpenAt(cafe, now.getHours() + now.getMinutes() / 60);
  const activities = getActivities(cafe);

  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Close with the Escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError("Please enter your name.");
    if (!rating) return setError("Please choose a star rating.");

    setSaving(true);
    setError("");
    try {
      await onSubmit({ cafeId: cafe.id, name: name.trim(), rating, comment: comment.trim() });
      setName("");
      setRating(0);
      setComment("");
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-label={`Details for ${cafe.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{cafe.name}</h2>
            <div className="card-meta">
              <p className="area">📍 {cafe.area}, {cafe.city}</p>
              <Rating stat={stat} />
              <span className={openNow ? "badge open" : "badge closed"}>{openNow ? "Open now" : "Closed"}</span>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <CafeImage cafe={cafe} tall />

        {VIBES[cafe.id] && <p className="vibe">{VIBES[cafe.id]}</p>}

        <div className="hours">
          <div>
            <small>Opens</small>
            <strong>{formatTime(cafe.open)}</strong>
          </div>
          <div>
            <small>Closes</small>
            <strong>{formatTime(cafe.close)}</strong>
          </div>
        </div>

        <h3 className="section-title">Things to do here</h3>
        <ul className="activity-grid">
          {activities.map((a) => (
            <li className="activity" key={a.title}>
              <span className="activity-icon" aria-hidden="true">{a.icon}</span>
              <div>
                <strong>{a.title}</strong>
                <p>{a.text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="fine-print">
          These are ideas based on the type of place. Check with the cafe about facilities, and ask before photographing other guests.
        </p>

        <h3 className="section-title">Location</h3>
        <iframe
          className="map-frame"
          title={`Map of ${cafe.name}`}
          src={mapEmbedUrl(cafe)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
        <a className="btn solid open-maps" href={directionsUrl(cafe)} target="_blank" rel="noopener noreferrer">
          Open in Google Maps
        </a>

        <h3 className="section-title">Reviews</h3>
        {reviews.length === 0 ? (
          <p className="area" style={{ margin: "16px 0" }}>No reviews yet. Be the first to write one.</p>
        ) : (
          <ul className="review-list">
            {reviews.map((r) => (
              <li className="review" key={r.id}>
                <div className="review-top">
                  <strong>{r.name}</strong>
                  <span className="review-stars" aria-label={`${r.rating} out of 5 stars`}>
                    {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                  </span>
                </div>
                {r.comment && <p>{r.comment}</p>}
                <span className="review-date">{new Date(r.date).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}

        {serverStatus === "ok" ? (
          <form className="review-form" onSubmit={handleSubmit}>
            <h3>Write a review</h3>
            <input
              type="text"
              placeholder="Your name"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="star-picker" role="radiogroup" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={n <= rating ? "on" : ""}
                  onClick={() => setRating(n)}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              placeholder="What did you think? (optional)"
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn solid" disabled={saving}>
              {saving ? "Saving..." : "Submit review"}
            </button>
          </form>
        ) : (
          <p className="offline-note">
            {serverStatus === "loading"
              ? "Loading reviews..."
              : "Reviews need the server. Stop the page, open a terminal in your project folder, run  node server.js  and open http://localhost:3000"}
          </p>
        )}
      </div>
    </div>
  );
}

function MapView({ cafesToShow, userPos }) {
  const mapBox = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  // Create the map once
  useEffect(() => {
    if (!window.L || !mapBox.current) return;
    const map = window.L.map(mapBox.current).setView([28.6139, 77.209], 11);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    layerRef.current = window.L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Redraw the pins whenever the results change
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const points = [];

    cafesToShow.forEach((cafe) => {
      if (cafe.lat == null) return;
      const popup =
        `<strong>${escapeHtml(cafe.name)}</strong><br>` +
        `${escapeHtml(cafe.area)}, ${escapeHtml(cafe.city)}<br>` +
        `${formatTime(cafe.open)} – ${formatTime(cafe.close)}<br>` +
        `<a href="${escapeHtml(directionsUrl(cafe))}" target="_blank" rel="noopener noreferrer">Directions</a>`;
      window.L.marker([cafe.lat, cafe.lng]).bindPopup(popup).addTo(layer);
      points.push([cafe.lat, cafe.lng]);
    });

    if (userPos) {
      window.L.circleMarker([userPos.lat, userPos.lng], {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: "#1a73e8",
        fillOpacity: 1,
      })
        .bindPopup("You are here")
        .addTo(layer);
      points.push([userPos.lat, userPos.lng]);
    }

    if (points.length) map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
  }, [cafesToShow, userPos]);

  if (!window.L) {
    return <p className="no-results">The map could not load. Check your internet connection and refresh.</p>;
  }

  return <div ref={mapBox} className="map-box" aria-label="Map of cafes" />;
}

function App() {
  const { pos, status: locStatus, locate } = useLocation();
  const [sortNearest, setSortNearest] = useState(false);
  const { query, setQuery, filter, setFilter, results } = useCafeSearch(pos, sortNearest);
  const { theme, toggleTheme } = useTheme();
  const { reviews, status: reviewStatus, addReview, stats } = useReviews();
  const [view, setView] = useState("list"); // list | map
  const [reviewCafeId, setReviewCafeId] = useState(null);
  const imageFiles = useImageList();

  const reviewCafe = cafes.find((c) => c.id === reviewCafeId);
  const missingOnMap = results.filter((c) => c.lat == null).length;

  function toggleNearest() {
    if (sortNearest) {
      setSortNearest(false);
      return;
    }
    setSortNearest(true);
    if (!pos) locate();
  }

  let locationNote = "";
  if (sortNearest && locStatus === "loading") locationNote = "Finding your location...";
  else if (sortNearest && locStatus === "denied") locationNote = "Location is blocked. Allow it in your browser (the lock icon by the address), then try again.";
  else if (sortNearest && locStatus === "unsupported") locationNote = "Your browser does not support location.";
  else if (sortNearest && pos) locationNote = "Sorted by distance from you, nearest first.";

  return (
    <ImagesContext.Provider value={imageFiles}>
    <div className="app" data-theme={theme}>
      <header className="hero">
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
        </button>

        <h1>Famous cafés in Delhi NCR</h1>
        <p>Search by name or area, check opening hours, and pick your spot.</p>

        <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
          <input
            type="search"
            placeholder="Search cafes or areas, e.g. Connaught Place"
            aria-label="Search cafes"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
      </header>

      <main className="container">
        <section className="filters" aria-label="Filters">
          {FILTERS.map((name) => (
            <button
              key={name}
              type="button"
              className={filter === name ? "chip active" : "chip"}
              onClick={() => setFilter(name)}
            >
              {name}
            </button>
          ))}
        </section>

        <section className="toolbar" aria-label="View options">
          <div className="seg" role="group" aria-label="Choose view">
            <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
              ☰ List
            </button>
            <button type="button" className={view === "map" ? "active" : ""} onClick={() => setView("map")}>
              🗺️ Map
            </button>
          </div>

          <button type="button" className={sortNearest ? "chip active" : "chip"} onClick={toggleNearest}>
            📍 Nearest first
          </button>
        </section>

        <p className={locStatus === "denied" || locStatus === "unsupported" ? "status-note warn" : "status-note"} aria-live="polite">
          {locationNote}
        </p>

        <p className="result-count" aria-live="polite">
          {results.length} cafe{results.length === 1 ? "" : "s"} found
        </p>

        {view === "list" ? (
          <section className="grid" aria-label="Cafe results">
            {results.map((cafe) => (
              <CafeCard key={cafe.id} cafe={cafe} stat={stats[cafe.id]} onOpenReviews={setReviewCafeId} />
            ))}
          </section>
        ) : (
          <>
            <MapView cafesToShow={results} userPos={pos} />
            <p className="map-note">
              Pins are placed by area, so they may be a little off the cafe's door. Tap Directions for the exact spot.
              {missingOnMap > 0 && ` ${missingOnMap} cafe${missingOnMap === 1 ? " is" : "s are"} not shown on the map (no exact location).`}
            </p>
          </>
        )}

        {results.length === 0 && (
          <p className="no-results">No cafes found. Try a different search or filter.</p>
        )}
      </main>

      <footer className="footer">
        <p>Timings can change, so check with the cafe before you go.</p>
      </footer>

      {reviewCafe && (
        <CafeDetail
          key={reviewCafe.id}
          cafe={reviewCafe}
          stat={stats[reviewCafe.id]}
          reviews={reviews.filter((r) => r.cafeId === reviewCafe.id)}
          serverStatus={reviewStatus}
          onClose={() => setReviewCafeId(null)}
          onSubmit={addReview}
        />
      )}
    </div>
    </ImagesContext.Provider>
  );
}

/* ---------- Start the app ---------- */
ReactDOM.createRoot(document.getElementById("root")).render(<App />);