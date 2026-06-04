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
  // Diễn giải tổng hợp (mới); null cho giấc mơ cũ chưa có -> các section dưới tự ẩn.
  const interp = dream.interpretation;
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
                      : !row.meaning &&
                        "Chưa ánh xạ được lá bài"}
                    {row.meaning && (
                      <div
                        style={{
                          marginTop: "6px",
                          fontStyle: "italic",
                          opacity: 0.82,
                          fontSize: "0.92em",
                          lineHeight: 1.45,
                        }}
                      >
                        {row.meaning}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}

      {interp && (
        <>
          {/* DIỄN GIẢI TỔNG HỢP */}
          {interp.summary_interpretation && (
            <>
              <div className="visions-card__section-title">
                Diễn giải tổng hợp
              </div>
              <div className="visions-card__body">
                {interp.summary_interpretation}
              </div>
            </>
          )}

          {/* CHỦ ĐỀ CHÍNH + CẢM XÚC NỀN */}
          {(interp.main_theme ||
            interp.emotional_tone) && (
            <div
              className="visions-card__chips"
              style={{ marginTop: "10px" }}
            >
              {interp.main_theme && (
                <div className="visions-card__chip">
                  Chủ đề: {interp.main_theme}
                </div>
              )}
              {interp.emotional_tone && (
                <div className="visions-card__chip">
                  Cảm xúc: {interp.emotional_tone}
                </div>
              )}
            </div>
          )}

          {/* LIÊN HỆ TRẢI BÀI GẦN ĐÂY */}
          <div className="visions-card__section-title">
            Liên hệ với trải bài gần đây
          </div>
          {interp.recent_reading_connections
            ?.length > 0 ? (
            <div className="visions-card__grid">
              {interp.recent_reading_connections.map(
                (conn, index) => (
                  <div
                    key={`${dream.id}-conn-${index}`}
                    className="visions-card__cell"
                  >
                    <div className="visions-card__cell-label">
                      {conn.question ||
                        `Phiên #${conn.session_id}`}
                    </div>
                    <div className="visions-card__cell-value">
                      {conn.connection}
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div
              className="visions-card__body"
              style={{ opacity: 0.75 }}
            >
              Chưa có phiên đọc bài gần đây để
              liên hệ.
            </div>
          )}

          {/* CÂU HỎI PHẢN TƯ */}
          {interp.reflection_questions
            ?.length > 0 && (
            <>
              <div className="visions-card__section-title">
                Câu hỏi phản tư
              </div>
              <div className="visions-card__body">
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "18px",
                  }}
                >
                  {interp.reflection_questions.map(
                    (q, index) => (
                      <li
                        key={`${dream.id}-rq-${index}`}
                        style={{
                          marginBottom: "6px",
                        }}
                      >
                        {q}
                      </li>
                    )
                  )}
                </ul>
              </div>
            </>
          )}

          {/* GỢI Ý HÀNH ĐỘNG HÔM NAY */}
          {interp.suggested_action && (
            <>
              <div className="visions-card__section-title">
                Gợi ý hành động hôm nay
              </div>
              <div className="visions-card__body">
                {interp.suggested_action}
              </div>
            </>
          )}

          {/* GHI CHÚ DỰ PHÒNG */}
          {interp.source ===
            "deterministic-fallback" && (
            <div
              className="visions-card__body"
              style={{
                marginTop: "8px",
                fontSize: "0.82em",
                opacity: 0.7,
              }}
            >
              Diễn giải được tạo bằng chế độ
              dự phòng.
            </div>
          )}
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
