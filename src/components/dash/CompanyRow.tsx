import Image, { StaticImageData } from "next/image";
import Link from "next/link";

export function CompanyRow({image, name}:{image: StaticImageData, name: string}) {
  return (
    <Link href={`/dash/${name.toLowerCase()}`} className="flex items-center gap-x-3 my-3 py-2 px-2 hover:bg-neutral-100 transition rounded-md hover:cursor-pointer">
      <Image
        src={image}
        alt={`${name} Logo`}
        className="size-5 rounded-md"
      />
      <div>{name}</div>
    </Link>
  );
}
