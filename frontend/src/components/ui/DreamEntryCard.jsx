import { MoonStar } from "lucide-react";

const formatDateTime = (value) => {
  if (!value) return "Không rõ thời gian";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export default function DreamEntryCard({
  dream,
}) {
  return (
    <div className="visions-card">
      <div className="visions-card__header">
        <div>
          <div className="visions-card__title">
            Bản ghi giấc mơ #{dream.id}
          </div>
          <div className="visions-card__meta">
            {formatDateTime(
              dream.created_at
            )}
          </div>
        </div>

        <div className="visions-card__status is-revealed">
          đã giải mã
        </div>
      </div>

      {dream.raw_text && (
        <>
          <div className="visions-card__section-title">
            Giấc mơ gốc
          </div>
          <div className="visions-card__body">
            {dream.raw_text}
          </div>
        </>
      )}

      {dream.transcript && (
        <>
          <div className="visions-card__section-title">
            Bản chép lời
          </div>
          <div className="visions-card__body">
            {dream.transcript}
          </div>
        </>
      )}

      {dream.symbols?.length >
        0 && (
        <>
          <div className="visions-card__section-title">
            Biểu tượng
          </div>
          <div className="visions-card__chips">
            {dream.symbols.map(
              (symbol) => (
                <div
                  key={`${dream.id}-${symbol}`}
                  className="visions-card__chip"
                >
                  {symbol}
                </div>
              )
            )}
          </div>
        </>
      )}

      {dream.mapped_arcana?.length >
        0 && (
        <>
          <div className="visions-card__section-title">
            Bản đồ ẩn tinh
          </div>
          <div className="visions-card__grid">
            {dream.mapped_arcana.map(
              (
                row,
                index
              ) => (
                <div
                  key={`${dream.id}-map-${index}`}
                  className="visions-card__cell"
                >
                  <div className="visions-card__cell-label">
                    {row.symbol ||
                      "Biểu tượng"}
                  </div>
                  <div className="visions-card__cell-value">
                    {Array.isArray(
                      row.arcana_candidates
                    ) &&
                    row.arcana_candidates.length >
                      0
                      ? row.arcana_candidates.join(
                          ", "
                        )
                      : "Không có ẩn tinh tương ứng"}
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}

      {dream.matches?.length >
        0 && (
        <>
          <div className="visions-card__section-title">
            Trải bài gần đây trùng khớp
          </div>
          <div className="visions-card__grid">
            {dream.matches.map(
              (
                match,
                index
              ) => (
                <div
                  key={`${dream.id}-match-${index}`}
                  className="visions-card__cell"
                >
                  <div className="visions-card__cell-label">
                    {match.card_name}
                  </div>
                  <div className="visions-card__cell-value">
                    {match.orientation}
                    <br />
                    {formatDateTime(
                      match.created_at
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}

      {dream.warnings?.length >
        0 && (
        <>
          <div className="visions-card__section-title">
            Ghi chú
          </div>
          <div className="visions-card__body">
            <MoonStar
              size={14}
              style={{
                marginRight: "8px",
              }}
            />
            {dream.warnings.join(
              " • "
            )}
          </div>
        </>
      )}
    </div>
  );
}
