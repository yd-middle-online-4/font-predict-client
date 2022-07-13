import React, { useState, useRef } from "react";

import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  Crop,
  PixelCrop,
} from "react-image-crop";
import { canvasPreview } from "./canvasPreview";
import { useDebounceEffect } from "./useDebounceEffect";

import "react-image-crop/dist/ReactCrop.css";

// This is to demonstate how to make and center a % aspect crop
// which is a bit trickier so we use some helper functions.
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

interface Result {
  font: string;
  font_idx: string;
}

export default function App() {
  const [imgSrc, setImgSrc] = useState("");
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [predict, setPredict] = useState<boolean>(false);
  const [filename, setFilename] = useState<string | boolean>(false);
  const [result, setResult] = useState<Result | undefined>();

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); // Makes crop preview update between images.
      const reader = new FileReader();
      reader.addEventListener("load", () =>
        setImgSrc(reader.result?.toString() || "")
      );
      reader.readAsDataURL(e.target.files[0]);
      setFilename(e.target.files[0].name);
    }
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (aspect) {
      const { width, height } = e.currentTarget;
      setCrop(centerAspectCrop(width, height, aspect));
    }
  }

  useDebounceEffect(
    async () => {
      if (
        completedCrop?.width &&
        completedCrop?.height &&
        imgRef.current &&
        previewCanvasRef.current
      ) {
        // We use canvasPreview as it's much faster than imgPreview.
        canvasPreview(
          imgRef.current,
          previewCanvasRef.current,
          completedCrop,
          scale,
          rotate
        );
      }
    },
    100,
    [completedCrop, scale, rotate]
  );

  function handleToggleAspectClick() {
    if (aspect) {
      setAspect(undefined);
    } else if (imgRef.current) {
      const { width, height } = imgRef.current;
      setAspect(1);
      setCrop(centerAspectCrop(width, height, 1));
    }
  }

  function haddleUpload(event: any) {
    event.preventDefault();
    setLoading(true);
    const imgURL = previewCanvasRef.current?.toDataURL("image/png");
    const address = "https://font-predict.herokuapp.com/predict";
    fetch(imgURL!)
      .then((res) => res.blob())
      .then((blob) => {
        let data = new FormData();
        data.append("image", blob, "image.png");
        // console.log(blob);
        // Upload
        fetch(address, {
          method: "POST",
          body: data,
        })
          .then((res) => {
            if (res.ok) {
              return res.json();
            }
            throw new Error("Network response was not ok.");
          })
          .then((data) => {
            setResult(data!.data);
            setLoading(false);
            setPredict(true);
          })
          .catch((error) => {
            // console.log(`error: ${error}`);
            setLoading(false);
          });
      });
  }

  // function haddleDownload() {
  //   const getImage = previewCanvasRef.current?.toDataURL("image/png");
  //   const download = document.getElementById("download");
  //   const image = getImage?.replace("image/png", "image/octet-stream");
  //   download?.setAttribute("href", image!);
  // }
  return (
    <div className="App">
      <div className="header">
        <h1>서체 폰트 판별기</h1>
        <h3>이미지를 업로드하고 문장에 맞춰서 잘라주세요.</h3>
        <p>아래는 예시입니다. (5글자 권장)</p>
        <img src={`/images/sample.jpg`} alt="" />
      </div>
      <div className="Crop-Controls">
        <div className="filebox">
          <label htmlFor="img_file">업로드</label>
          <input
            id="img_file"
            type="file"
            accept="image/*"
            onChange={onSelectFile}
          />
          {filename && <span>{filename}</span>}
        </div>
        <div>
          <label htmlFor="scale-input">배율: </label>
          <input
            id="scale-input"
            type="number"
            step="0.1"
            value={scale}
            disabled={!imgSrc}
            onChange={(e) => setScale(Number(e.target.value))}
          />
        </div>
        <div>
          <label htmlFor="rotate-input">회전: </label>
          <input
            id="rotate-input"
            type="number"
            value={rotate}
            disabled={!imgSrc}
            onChange={(e) =>
              setRotate(Math.min(180, Math.max(-180, Number(e.target.value))))
            }
          />
        </div>
        <div className="toggle">
          <button onClick={handleToggleAspectClick}>
            비율 고정 {aspect ? "on" : "off"}
          </button>
        </div>
      </div>
      {Boolean(imgSrc) && (
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={aspect}
        >
          <img
            className="original-img"
            ref={imgRef}
            alt="Crop me"
            src={imgSrc}
            style={{ transform: `scale(${scale}) rotate(${rotate}deg)` }}
            onLoad={onImageLoad}
          />
        </ReactCrop>
      )}
      <div>
        {Boolean(completedCrop) && (
          <canvas
            ref={previewCanvasRef}
            style={{
              border: "1px solid black",
              objectFit: "contain",
              width: completedCrop?.width,
              height: completedCrop?.height,
            }}
          />
        )}
      </div>
      {filename && (
        <form className="submit" onSubmit={(e) => haddleUpload(e)}>
          <button>Submit</button>
        </form>
      )}
      {loading && (
        <div>
          <span>제출 중...</span>
        </div>
      )}
      {predict && (
        <div>
          <h1>분석 결과</h1>
          <h3>{result?.font}</h3>
          <img src={`/images/${result?.font_idx}.jpg`} alt="" />
        </div>
      )}
    </div>
  );
}
