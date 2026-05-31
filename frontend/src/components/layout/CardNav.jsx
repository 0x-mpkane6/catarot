import {
  useLayoutEffect,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";

import { gsap } from "gsap";
import { GoArrowUpRight } from "react-icons/go";

import "./CardNav.css";

const CardNav = ({
  logo,
  logoAlt = "Logo",

  items,

  className = "",
  ease = "power3.out",

  baseColor = "#fff",
  menuColor,

  buttonBgColor,
  buttonTextColor,

  buttonLabel = "Bắt đầu",
  onButtonClick,
}) => {

  const [isHamburgerOpen, setIsHamburgerOpen] =
    useState(false);

  const [isExpanded, setIsExpanded] =
    useState(false);

  const navRef = useRef(null);
  const cardsRef = useRef([]);
  const tlRef = useRef(null);

  const calculateHeight = useCallback(() => {

    const navEl = navRef.current;

    if (!navEl) return 260;

    const isMobile =
      window.matchMedia("(max-width: 768px)")
        .matches;

    if (isMobile) {

      const contentEl =
        navEl.querySelector(".card-nav-content");

      if (contentEl) {

        const wasVisible =
          contentEl.style.visibility;

        const wasPointerEvents =
          contentEl.style.pointerEvents;

        const wasPosition =
          contentEl.style.position;

        const wasHeight =
          contentEl.style.height;

        contentEl.style.visibility =
          "visible";

        contentEl.style.pointerEvents =
          "auto";

        contentEl.style.position =
          "static";

        contentEl.style.height =
          "auto";

        contentEl.offsetHeight;

        const topBar = 60;
        const padding = 16;

        const contentHeight =
          contentEl.scrollHeight;

        contentEl.style.visibility =
          wasVisible;

        contentEl.style.pointerEvents =
          wasPointerEvents;

        contentEl.style.position =
          wasPosition;

        contentEl.style.height =
          wasHeight;

        return (
          topBar +
          contentHeight +
          padding
        );
      }
    }

    return 260;
  }, []);

  const createTimeline = useCallback(() => {

    const navEl = navRef.current;

    if (!navEl) return null;

    gsap.set(navEl, {
      height: 60,
      overflow: "hidden",
    });

    gsap.set(cardsRef.current, {
      y: 50,
      opacity: 0,
    });

    const tl = gsap.timeline({
      paused: true,
    });

    tl.to(navEl, {
      height: calculateHeight,
      duration: 0.3,
      ease,
    });

    tl.to(
      cardsRef.current,
      {
        y: 0,
        opacity: 1,
        duration: 0.4,
        ease,
        stagger: 0.08,
      },
      "-=0.1"
    );

    return tl;
  }, [calculateHeight, ease]);

  useLayoutEffect(() => {

    const tl = createTimeline();

    tlRef.current = tl;

    return () => {

      tl?.kill();

      tlRef.current = null;
    };

  }, [createTimeline, items]);

  useLayoutEffect(() => {

    const handleResize = () => {

      if (!tlRef.current) return;

      if (isExpanded) {

        const newHeight =
          calculateHeight();

        gsap.set(navRef.current, {
          height: newHeight,
        });

        tlRef.current.kill();

        const newTl =
          createTimeline();

        if (newTl) {

          newTl.progress(1);

          tlRef.current = newTl;
        }

      } else {

        tlRef.current.kill();

        const newTl =
          createTimeline();

        if (newTl) {

          tlRef.current = newTl;
        }
      }
    };

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {

      window.removeEventListener(
        "resize",
        handleResize
      );
    };

  }, [calculateHeight, createTimeline, isExpanded]);

  const closeMenu = () => {

    const tl = tlRef.current;

    setIsHamburgerOpen(false);
    setIsExpanded(false);

    tl?.reverse();
  };

  const toggleMenu = () => {

    const tl = tlRef.current;

    if (!tl) return;

    if (!isExpanded) {

      setIsHamburgerOpen(true);
      setIsExpanded(true);

      tl.play(0);

    } else {

      closeMenu();
    }
  };

  useEffect(() => {

    const handleClickOutside = (e) => {

      if (
        navRef.current &&
        !navRef.current.contains(
          e.target
        )
      ) {

        if (isExpanded) {

          closeMenu();
        }
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {

      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };

  }, [isExpanded]);

  const setCardRef = (i) => (el) => {

    if (el) {

      cardsRef.current[i] = el;
    }
  };

  return (
    <div
      className={`card-nav-container ${className}`}
    >
      <nav
        ref={navRef}
        className={`card-nav ${
          isExpanded ? "open" : ""
        }`}
        style={{
          backgroundColor: baseColor,
        }}
      >

        {/* TOP BAR */}
        <div className="card-nav-top">

          {/* HAMBURGER */}
          <div
            className={`hamburger-menu ${
              isHamburgerOpen
                ? "open"
                : ""
            }`}
            onClick={toggleMenu}
            role="button"
            aria-label={
              isExpanded
                ? "Đóng menu"
                : "Mở menu"
            }
            tabIndex={0}
            style={{
              color:
                menuColor || "#000",
            }}
          >
            <div className="hamburger-line" />
            <div className="hamburger-line" />
          </div>

          {/* LOGO */}
          <div className="logo-container">

            {logo ? (

              <img
                src={logo}
                alt={logoAlt}
                className="logo"
              />

            ) : (

              <span
                style={{
                  color: "white",

                  fontWeight: 700,

                  letterSpacing:
                    "0.15em",
                }}
              >
                CATAROT
              </span>
            )}
          </div>

          {/* BUTTON */}
          <button
            type="button"
            className="card-nav-cta-button"
            style={{
              backgroundColor:
                buttonBgColor,

              color:
                buttonTextColor,
            }}
            onClick={onButtonClick}
          >
            {buttonLabel}
          </button>
        </div>

        {/* EXPAND CONTENT */}
        <div
          className="card-nav-content"
          aria-hidden={!isExpanded}
        >

          {(items || [])
            .slice(0, 3)
            .map((item, idx) => (

              <div
                key={`${item.label}-${idx}`}
                className="nav-card"
                ref={setCardRef(idx)}
                style={{
                  backgroundColor:
                    item.bgColor,

                  color:
                    item.textColor,
                }}
              >

                <div className="nav-card-label">
                  {item.label}
                </div>

                <div className="nav-card-links">

                  {item.links?.map(
                    (lnk, i) => (

                      <a
                        key={`${lnk.label}-${i}`}
                        className="nav-card-link"
                        href={lnk.href}
                        aria-label={
                          lnk.ariaLabel
                        }

                        onClick={() => {

                          lnk.onClick?.();

                          closeMenu();
                        }}
                      >

                        <GoArrowUpRight
                          className="nav-card-link-icon"
                          aria-hidden="true"
                        />

                        {lnk.label}
                      </a>
                    )
                  )}
                </div>
              </div>
            ))}
        </div>
      </nav>
    </div>
  );
};

export default CardNav;

