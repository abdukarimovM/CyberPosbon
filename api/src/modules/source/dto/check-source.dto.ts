import { IsString, IsUrl } from 'class-validator';

export class CheckSourceDto {
  @IsString()
  @IsUrl({
    require_protocol: true,
  })
  url!: string;
}