export default function ScrollStyle() {

  return (
    <style>
      {`

        /* width */
        ::-webkit-scrollbar {
          width: 10px;
        }

        /* track */
        ::-webkit-scrollbar-track {
          background:
            rgba(255,255,255,0.03);

          border-radius: 999px;
        }

        /* thumb */
        ::-webkit-scrollbar-thumb {

          background:
            linear-gradient(
              180deg,
              #a855f7,
              #d946ef
            );

          border-radius: 999px;

          box-shadow:
            0 0 12px
            rgba(217,70,239,0.35);
        }

        ::-webkit-scrollbar-thumb:hover {

          background:
            linear-gradient(
              180deg,
              #c084fc,
              #e879f9
            );
        }

        * {
          scrollbar-width: thin;

          scrollbar-color:
            #c084fc
            rgba(255,255,255,0.04);
        }

      `}
    </style>
  );
}