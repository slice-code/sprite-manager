export interface FrameCoord {
  filename: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function generateJSONExport(
  projectName: string,
  frames: FrameCoord[],
  sheetWidth: number,
  sheetHeight: number
): string {
  const meta = {
    app: "Sprite Sheet Manager by AI Studio",
    version: "2026.1.0",
    image: `${projectName.toLowerCase().replace(/\s+/g, '_')}_sheet.png`,
    format: "RGBA8888",
    size: { w: sheetWidth, h: sheetHeight },
    scale: "1"
  };

  const framesObj: Record<string, any> = {};
  frames.forEach((f, idx) => {
    framesObj[f.filename] = {
      frame: { x: f.x, y: f.y, w: f.w, h: f.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
      sourceSize: { w: f.w, h: f.h }
    };
  });

  return JSON.stringify({ frames: framesObj, meta }, null, 2);
}

export function generateXMLExport(
  projectName: string,
  frames: FrameCoord[],
  sheetWidth: number,
  sheetHeight: number
): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<TextureAtlas imagePath="${projectName.toLowerCase().replace(/\s+/g, '_')}_sheet.png" width="${sheetWidth}" height="${sheetHeight}">\n`;
  
  frames.forEach((f) => {
    xml += `  <subTexture name="${f.filename}" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}"/>\n`;
  });
  
  xml += `</TextureAtlas>`;
  return xml;
}

export function generateUnityExport(
  projectName: string,
  frames: FrameCoord[],
  sheetWidth: number,
  sheetHeight: number
): string {
  let meta = `fileFormatVersion: 2\nguid: db84ef81fc8347f8ba1fcdcf73fb9e9f\nTextureImporter:\n  fileIDToRecycleName:\n`;
  
  frames.forEach((f, idx) => {
    meta += `    21300000: ${projectName}_${idx}\n`;
  });

  meta += `  spriteSheet:\n    sprites:\n`;
  frames.forEach((f, idx) => {
    meta += `    - serializedVersion: 2\n`;
    meta += `      name: ${projectName}_${idx}\n`;
    meta += `      rect:\n`;
    meta += `        serializedVersion: 2\n`;
    meta += `          x: ${f.x}\n`;
    meta += `          y: ${f.y}\n`;
    meta += `          width: ${f.w}\n`;
    meta += `          height: ${f.h}\n`;
    meta += `      alignment: 0\n`;
    meta += `      pivot: {x: 0.5, y: 0.5}\n`;
    meta += `      border: {x: 0, y: 0, z: 0, w: 0}\n`;
    meta += `      outline: []\n`;
    meta += `      physicsShape: []\n`;
  });
  meta += `  spritePackingTag: ${projectName}\n`;
  return meta;
}

export function generateGodotExport(
  projectName: string,
  frames: FrameCoord[],
  frameWidth: number,
  frameHeight: number
): string {
  let tres = `[gd_resource type="SpriteFrames" load_steps=2 format=3]\n\n`;
  tres += `[ext_resource type="Texture2D" path="res://${projectName.toLowerCase().replace(/\s+/g, '_')}_sheet.png" id="1_atlas"]\n\n`;
  tres += `[resource]\nanimations = [{\n`;
  tres += `"frames": [\n`;

  frames.forEach((f) => {
    tres += `  { "duration": 1.0, "texture": SubResource("AtlasTexture_x") }, # x, y rect = (${f.x}, ${f.y}, ${f.w}, ${f.h})\n`;
  });

  tres += `],\n"loop": true,\n"name": &"default",\n"speed": 10.0\n}]`;
  return tres;
}

export function generatePhaserExport(
  projectName: string,
  frames: FrameCoord[],
  sheetWidth: number,
  sheetHeight: number
): string {
  const phaserAtlas = {
    textures: [
      {
        image: `${projectName.toLowerCase().replace(/\s+/g, '_')}_sheet.png`,
        size: { w: sheetWidth, h: sheetHeight },
        frames: frames.map((f) => ({
          filename: f.filename,
          frame: { x: f.x, y: f.y, w: f.w, h: f.h },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
          sourceSize: { w: f.w, h: f.h },
          pivot: { x: 0.5, y: 0.5 }
        }))
      }
    ],
    meta: {
      app: "Sprite Sheet Manager by AI Studio",
      version: "2026.1.0",
      smartupdate: "$TexturePacker:SmartUpdate:b7787f0bbf7fa56a620d41e779f42bca$"
    }
  };

  return JSON.stringify(phaserAtlas, null, 2);
}
