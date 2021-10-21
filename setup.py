import setuptools

with open("README.md", "r") as fh:
    long_description = fh.read()

setuptools.setup(
    name='curl2scrapy',
    version='0.1',
    author='Thomas Aitken',
    author_email='tclaitken@gmail.com',
    description='Converts curl commands to Scrapy requests.',
    long_description=long_description,
    long_description_content_type='text/markdown',
    url='https://github.com/ThomasAitken/Curl2Scrapy',
    packages=setuptools.find_packages(),
    classifiers=[
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.6',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'License :: OSI Approved :: BSD License',
        'Operating System :: OS Independent',
    ],
    entry_points={
        'console_scripts': [
            'curl2scrapy=curl2scrapy:main',
        ],
    },
)