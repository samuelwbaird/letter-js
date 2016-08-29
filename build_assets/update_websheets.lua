-- a sample spritesheet builder using the bozo library (https://github.com/samuelwbaird/bozo)
-- copyright 2016 Samuel Baird MIT Licence

-- iterate a series of folder containing sprite assets and produce spritesheets for each source
-- generate a range of scaled output as required. Multiple sheets are generated per folder
-- if the assets do not fit the maximum sheet size
--
-- transparent borders are cropped from source images, but the specified registration of the original
-- image is preserved
--
-- spritesheet data is required as Lua code (executable in a sandbox)

local array = require('core.array')
local bozo = require('bozo')
local atlasbuilder = require('bozo.atlasbuilder')
local cjson = require('cjson')

--  settings

-- source art is considered to be at the following scale
local source_scale = 1

-- output is required at the following output_scales
local output_scales = { 1 }

-- maximum spritesheet size (x scale)
local max_sheet_size = 1024

-- paths
local input_path = 'input/'
local output_path = '../example_assets/'

-- generate spritesheets as required for a given input folder

function create_spritesheet(name, sources, clips)

	-- this process runs once for each required output scale
	for _, scale in ipairs(output_scales) do
		-- create an atlas builder
		local atlas = atlasbuilder()
		for _, source in ipairs(sources) do
			local path, anchor_x, anchor_y = source[1], source[2] or 0.5, source[3] or 0.5
		
			-- get all the images together, using bozo it iterate all the input files		
			for _, file in ipairs(bozo.files(input_path .. path, 'png')) do
				local image = bozo.image(file.absolute)
				if scale ~= source_scale then
					-- high quality downsizing if required
					local scaled = image:resized_to(math.floor(image:width() * scale / source_scale), math.floor(image:height() * scale / source_scale), 'lanczos3', true)
					image:dispose()
					image = scaled
				end
				-- add the image to the atlas, preserving the anchor and asset scale
				atlas:add_image(file.name, image, scale, anchor_x, anchor_y)
			end
		end

		-- now 'solve' the layout at a given maximum sheet size
		local result = atlas:solve(scale, scale * max_sheet_size)
		
		-- the output will be some number of sheets, however many are required to fit the assets
		local basename = name .. '_x' .. scale
		print(basename)
		local description = assert(io.open(output_path .. basename .. '_description.json', 'w'))
		local data = {}
		data.header = {
			version = 1,
			clip_style = 'x,y,sx,sy,r,a',
		}

		data.sheets = {}
		for index, output in ipairs(result) do
			local basename = name .. '_' .. index .. '_x' .. scale
			
			-- size specific image
			local image = output:image()
			
			-- first write the instruction to load the image
			local sheet = {
				file = basename .. '.png',
				width = image:width(),
				height = image:height(),
				entries = {},
			}
			data.sheets[#data.sheets + 1] = sheet

			for _, entry in ipairs(output:entries()) do
				-- xy is relative position at scale of 1 of corners of the sprite against the anchor
				-- uv is 0 - 1 position of the corners of the sprite in the sheet
				sheet.entries[#sheet.entries + 1] = {
					name = entry.name,
					xy = entry.xy,
					uv = entry.uv
				}
			end
			
			image:save(output_path .. basename .. '.png')
			-- free up memory
			image:dispose()
		end
		
		data.clips = {}
		if clips then
			-- take the simple image sequences provided and generate a full clip specification for them
			for name, frames in pairs(clips) do
				local all_are_strings = true
				for _, frame in ipairs(frames) do
					if type(frame) ~= 'string' then
						all_are_strings = false
						break
					end
				end
				local clip = {
					name = name,
					frames = {},
				}
				data.clips[#data.clips + 1] = clip
				
				if all_are_strings then
					-- are the frames just a sequence of names? if so write out the animation data for a sprite sequence
					for _, frame in ipairs(frames) do
						clip.frames[#clip.frames + 1] = {
							-- label = '',
							content = {{
								image = frame,
								transform = { 0, 0, 1, 1, 0, 1 }
						}}}
					end
				else
					-- if the frames are more complex then just include them verbatim as animation data
					for _, frame in ipairs(frames) do
						-- description:write('  {')
						-- if frame.label then
						-- 	description:write('label = \'' .. frame.label .. '\' ')
						-- end
						-- description:write('content = {\n')
					end
				end
			end
		end
		description:write(cjson.encode(data))
		
		-- free up memory
		atlas:dispose()
		description:close()
	end
end

-- create a sprite sheet for the title screen assets
create_spritesheet(
	-- output resource name
	'map',
	-- specify the source folders, with the registration point offset to use for those images
	{
		{ 'map', 0.5, 0.5 },
	},
	-- animation data
	{
	}
)

source_scale = 4
create_spritesheet(
	-- output resource name
	'test',
	-- image source folders
	{
		{ 'test', 0.5, 0.5 },
	},
	-- animation data
	{
		button = { 'play_button0001', 'play_button0002' }
	}
)
